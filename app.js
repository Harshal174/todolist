//jshint esversion:6
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const _ = require('lodash');
const bcrypt = require('bcryptjs');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

require("dotenv").config();

const app = express();


app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({extended:true}));
app.use(express.static("public"));
//  mongodb://localhost:27017
app.use(session({secret:"secret",resave:false,saveUninitialized:false}));
app.use(cookieParser());
app.use(passport.initialize());
app.use(passport.session());

main().catch(err => console.log(err));

async function main() {
  await mongoose.connect(process.env.MONGO_URI, {useNewUrlParser: true},{useUnifiedTopology:true});
}

// mongoose.connect(process.env.MONGO_URI, {useNewUrlParser: true});

const itemsSchema = {
    name:String,
    date: Date,
    priority: String,
    starred: { type: Boolean, default: false } // Optional: For starred tasks

};
const Item = mongoose.model("item",itemsSchema);
// const Item1= new Item({
//     name:"Welcome to your to do list"
// });

// const Item2= new Item({
//     name:"Hit the + button to add a new item"
// });

// const Item3= new Item({
//     name:"<-- Hit this to delete an item."
// });


const defaultItems=[];

const completedTaskSchema={
    listName:String,
    name:String,
    completedAt:{
        type:Date,
        default:Date.now
    }
};

const CompletedTask=mongoose.model("CompletedTask",completedTaskSchema);

const registerSchema=new mongoose.Schema({
    username:{type:String,required:true,unique:true},
    password:{type:String,required:true},
})

const Register=mongoose.model("Register",registerSchema);

const listSchema = {
    name: String,
    items: [itemsSchema]
};
// Add this route in app.js

app.get('/dashboard', authenticateJWT, async (req, res) => {
    try {
        const lists = await List.find({});
        res.render('list', { lists: lists });
    } catch (err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
    }
});

app.post('/createList', authenticateJWT, async (req, res) => {
    const listName = req.body.listName.trim();
    const taskNames = req.body.taskName;
    const taskDates = req.body.taskDate;
    const taskPriorities = req.body.taskPriority;

    // Ensure listName is provided
    if (!listName) {
        return res.status(400).send("List name is required.");
    }

    // Ensure tasks are provided
    if (!taskNames || !taskDates || !taskPriorities) {
        return res.status(400).send("At least one task is required.");
    }

    // If single task, wrap in arrays
    const tasks = [];
    if (typeof taskNames === 'string') {
        tasks.push({
            name: taskNames.trim(),
            date: taskDates,
            priority: taskPriorities
        });
    } else {
        for (let i = 0; i < taskNames.length; i++) {
            const name = taskNames[i].trim();
            const date = taskDates[i];
            const priority = taskPriorities[i];

            if (name && date && priority) { // Validate each task
                tasks.push({ name, date, priority });
            }
        }
    }

    // Create the list with tasks
    const newList = new List({
        name: listName,
        items: tasks.map(task => ({
            name: task.name,
            date: task.date,
            priority: task.priority
        }))
    });

    try {
        await newList.save();
        res.redirect('/' + listName);
    } catch (error) {
        console.error(error);
        res.status(500).send("Error creating the list.");
    }
});

const List = mongoose.model("List",listSchema);




//Date module not working that's why using today instead of current day and date...
// let today = new Date();
    
// let options ={
//     weekday:'long',
//     day:'numeric',
//     month:'long'
// };

// let day = today.toLocaleDateString("en-US",options);

function authenticateJWT(req,res,next){
    const token=req.cookies.jwt;
    
    if(!token){
        return res.redirect('/');
    }
    jwt.verify(token,process.env.TOKEN_SECRET,(err,decodedToken)=>{
        if(err){            
            console.log(err);
            return res.redirect('/');
        }
        req.user=decodedToken;
        next();
    })
}


app.get('/',(req,res)=>{
    res.render('homepage');
});
passport.use(new LocalStrategy(
    async(username,password,done)=>{
        const foundUser=await Register.findOne({username:username});
        if(!foundUser) {
            return done(null,false,{message:"Incorrect username"});
        }

        const isFound=await bcrypt.compare(password,foundUser.password);
        if(!isFound) {
            return done(null,false,{message:"Incorrect password"});
        }
        return done(null,foundUser);
    }
))
passport.serializeUser((user,done)=>{
    done(null,user.id);
})
passport.deserializeUser(async (id, done) => {
    try {
      const user = await Register.findById(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });
app.post('/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
      if (err) { 
        return next(err); 
      }
      if (!user) {
        
        return res.redirect('/'); // Redirect if login fails
      }
  
      req.logIn(user, (err) => {
        if (err) { 
          return next(err); 
        }
        // Redirect the user to their custom route after login
        const token = jwt.sign({id:user._id,username:user.username},process.env.TOKEN_SECRET,{expiresIn:'24h'});
        
        res.cookie('jwt',token,{httpOnly:true,maxAge:24*60*60*1000});
        return res.redirect('/' + user.username);
      });
    })(req, res, next);
  });

app.post('/logout',(req,res)=>{
    res.clearCookie('jwt');
    res.redirect('/');
})

app.post('/register',async(req,res)=>{
    const data=(req.body.username)+Math.floor(Math.random()*1000);    
    const data1=req.body.password;
    const hashedPassword=await bcrypt.hash(data1,10);
    try {
        const user = new Register({
            username:data,
            password:hashedPassword,
        })
        await user.save();
        const token = jwt.sign({id:user._id,username:user.username},process.env.TOKEN_SECRET,{expiresIn:'24h'});
        res.cookie('jwt',token,{httpOnly:true,maxAge:24*60*60*1000});
        return res.redirect('/'+data);
    } catch (error) {
        console.log(error);
    }
})


app.post('/search',authenticateJWT,async(req,res)=>{
    const userName=_.capitalize(req.body.userName);
    try{
        const foundList=await List.findOne({name:userName});
        if(foundList){
            res.redirect('/'+userName);
        }else{
            const newList= new List ({
                name:userName,
                items:defaultItems
            });
            console.log(newList);
            await newList.save();
            res.redirect('/'+userName);
        }
    }catch(err){
        console.log(err);
    }    
});

// app.get("/",(req,res)=>{ 
//        const find= async()=>{
//         try{
//             const data = await Item.find({});
//             const completedItems= await CompletedTask.find({});
//             // console.log(data)
//             if(data.length===0){
//                 Item.insertMany(defaultItems).then(function(err){
//                     if(err){
//                         console.error(err);
//                         res.status(500).send("Internal Server Error");
//                     }else{
//                         console.log("Success!!!");
//                     }
//                 })
//                 res.redirect("/");
//             }else{
//                 res.render("list",{listTitle: "Today" , newListItems: data,completedItems:completedItems }); 
//             } 
//         }catch(err){
//             console.error(err);
//         }
//        }
//        find();
    
// })

app.get("/complete/:listTitle",authenticateJWT,async(req,res)=>{
       const saveListName=_.capitalize(req.params.listTitle)
       
    try{
        const completedTask= await CompletedTask.find({listName:saveListName});
        res.render("completedtask",{completedTask:completedTask,previousURL:saveListName});
    }catch(err){
        console.log(err);
    }
})

app.post('/complete/:listName',authenticateJWT,async(req,res)=>{
    const completeTaskId=req.body.checkbox;
    const listName=req.params.listName;

    try{
        await CompletedTask.findByIdAndRemove(completeTaskId);
        res.redirect('/complete/'+listName);
    }catch(err){
        console.log(err);
    }
})


app.post('/delete-list',authenticateJWT,async(req,res)=>{
    const getListName=req.body.deleteList;
    try{
        const dataList=await List.find({name:getListName});
        const listId=dataList[0]._id;
        await List.findByIdAndDelete({_id:listId});
        res.redirect('/');
    }catch(err){
        console.log(err);
    }
})


app.get("/:customListName",authenticateJWT,async(req,res)=>{
    const customListName = _.capitalize(req.params.customListName);
    
    const completedItems= await CompletedTask.find({});
    
    
    const findOne = async()=>{
        try{
            const data1=await List.findOne({name: customListName});
            // console.log(data1);  
            if(data1===null){
                const list = new List({
                    name: customListName,
                    items: defaultItems
                });
                list.save();
                res.redirect("/"+ customListName);
            }else{
                res.render("list",{listTitle: data1.name, newListItems: data1.items,completedItems:completedItems});
            }
        }catch(err){
            console.error(err);
            res.status(500).send("Internal Server Error");
        }
    }

    findOne();

    // List.findOne({name: customListName}),(function(err, foundList){
    //     if(!err){
    //         if(!foundList){
    //             const list = new List({
    //                 name: customListName,
    //                 items: defaultItems
    //             });
    //                list.save();
    //                res.redirect("/"+customListName);
    //         }else{
    //             res.render("list",{listTitle: foundList.name , newListItems: foundList.items})
    //         }
    //     }
    // }) 
})

app.post("/", (req,res)=>{
     const itemName = req.body.newItem;
     const listName = req.body.list;

     const cleanedItemName = itemName.replace(/\s+/g, ' ').trim();
     
     if (!cleanedItemName) {
        console.log("Empty");
        return res.redirect("/" + (listName === "Today" ? "" : listName));  // Redirect to the correct list
    }else{
        const item = new Item({
            name:cleanedItemName
         });
         if(listName==="Today"){
            item.save();
            res.redirect("/");
         }else{
            const findTwo = async ()=>{
                try{
                    const data2 = await List.findOne({name:listName});
                        data2.items.push(item);
                        data2.save();
                        res.redirect("/"+ listName);   
                }catch(err){
                    console.error(err);
                    res.status(500).send("Internal Server Error");
                }
            }
            findTwo();
         }     
     }
     
});



app.post("/complete",authenticateJWT,async(req,res)=>{
    const completedTaskId=req.body.completedCheckbox;
    const listNames= await CompletedTask.findOne({_id:completedTaskId});
    console.log(completedTaskId,listNames);
    const storeNames=listNames;
    console.log(storeNames);
    
    
    const isPresent= await CompletedTask.find({listName:storeNames});
    if(completedTaskId){
        await CompletedTask.findByIdAndRemove(completedTaskId).then(function(err){
            res.redirect('/complete');
            if(!err){
                console.log("Successfully deleted");
            }else{
                console.log(err);
            }
        })
    }else{
        console.log(err);
    }
})

app.post("/delete",authenticateJWT,async(req,res)=>{
    const checkedItemId=(req.body.checkbox);
    const listName = (req.body.listTitle);
    const completedTaskId=(req.body.completedCheckbox);
    // console.log(checkedItemId,listName);
    // console.log(completedTaskId,listName,checkedItemId);
    
    
    
        if(checkedItemId){
        
            try{
                    await List.findOneAndUpdate({name:listName},{$pull:{items: {_id:checkedItemId}}});
                    res.redirect("/"+ listName); 
            }catch(err){
                console.error(err);
            }
        }else if(completedTaskId){
            try {
                const otherListTaskId=completedTaskId;
                const findOtherListTaskName= await List.findOne(
                {name:listName,"items._id":otherListTaskId},{ "items.$": 1 }
            );            
            if(findOtherListTaskName){
                const completedTask= new CompletedTask({
                    listName:listName,
                    name:findOtherListTaskName.items[0].name
                });
                await completedTask.save();
                await List.findOneAndUpdate({name:listName},{$pull:{items:{_id:completedTaskId}}});
                res.redirect("/"+listName);
            }else{
                console.log("Error");
            }                  
    }catch(error){
        console.log(error);
    }
}
});



    


app.listen(process.env.PORT||3000,()=>{
    console.log("Server started on port 3000!!!");
})  