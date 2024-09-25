//jshint esversion:6
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const _ = require('lodash');

const app = express();


app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({extended:true}));
app.use(express.static("public"));
//  mongodb://localhost:27017

main().catch(err => console.log(err));

async function main() {
  await mongoose.connect("mongodb+srv://admin-harshal:qJZARUUqvSKbdoKJ@cluster0.mx6bkrb.mongodb.net/todolistDB", {useNewUrlParser: true},{useUnifiedTopology:true});

}
// mongoose.connect("mongodb+srv://admin-harshal:qJZARUUqvSKbdoKJ@cluster0.mx6bkrb.mongodb.net/todolistDB", {useNewUrlParser: true});

const itemsSchema = {
    name:String
};
const Item = mongoose.model("item",itemsSchema);
const Item1= new Item({
    name:"Welcome to your to do list"
});

const Item2= new Item({
    name:"Hit the + button to add a new item"
});

const Item3= new Item({
    name:"<-- Hit this to delete an item."
});

const defaultItems=[Item1,Item2,Item3];

const listSchema = {
    name: String,
    items: [itemsSchema]
};

const List = mongoose.model("List",listSchema);


//Date module not working that's why using today instead of current day and date...
// let today = new Date();
    
// let options ={
//     weekday:'long',
//     day:'numeric',
//     month:'long'
// };

// let day = today.toLocaleDateString("en-US",options);


app.get("/",(req,res)=>{ 
       const find= async()=>{
        try{
            const data = await Item.find({});
            // console.log(data)
            if(data.length===0){
                Item.insertMany(defaultItems).then(function(err){
                    if(err){
                        console.log(err);
                    }else{
                        console.log("Success!!!");
                    }
                })
                res.redirect("/");
            }else{
                res.render("list",{listTitle: "Today" , newListItems: data}); 
            } 
        }catch(err){
            console.log(err);
        }
       }
       find();
    
})


app.get("/:customListName",(req,res)=>{
    const customListName = _.capitalize(req.params.customListName);
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
                res.render("list",{listTitle: data1.name, newListItems: data1.items});
            }
        }catch(err){
            console.log(err);
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

     const item = new Item({
        name:itemName
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
                console.log(err);
            }
        }
        findTwo();
     }



     
});

app.post("/delete",(req,res)=>{
    const checkedItemId=(req.body.checkbox);
    const listName = req.body.listName;
    if(listName==="Today"){
        Item.findByIdAndRemove(checkedItemId).then(function(err){
            res.redirect("/");
            if(!err){
                console.log("Successfully deleted item")
            }else{
                console.log(err);
            }
        });
    }else{
        const findThree = async()=>{
            try{
               const data3 = await List.findOneAndUpdate({name:listName},{$pull:{items: {_id:checkedItemId}}});
               res.redirect("/"+ listName);
            }catch(err){
                console.log(err);
            }
        }
        findThree();
    //     // List.findOneAndUpdate({name:listName},{$pull:{items: {_id:checkedItemId}}}).then(function(err,foundItems){
    //     //     if(!err){
    //     //         res.redirect("/"+ listName);
    //     //     }
    //     })
    }

    
});
    
    
// })

// app.get("/Work",(req,res)=>{
//      res.render("list",{listTitle: "Work List", newListItems: workItems});
// })

// app.post("/work",(req,res)=>{
//     let item = req.body.newItem;
// })


app.listen(process.env.PORT||3000,()=>{
    console.log("Server started on port 3000!!!");
})
