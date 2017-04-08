//Require the Node Modules
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var express = require('express');
var moment = require('moment');

//Initialize the Server
var app = express();
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());

//Handle Mongoose Schema
var system = require('./models/system')
mongoose.connect('mongodb://localhost:27017/bobdb');
var db = mongoose.connection;

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.get('/bob/system', function(req, res) {
    var name = req.query.system;
    system.getSystemById(name, function(err, data) {
        if (err) {
            throw err;
        }
        console.log("--------------------------------------------------------");
        console.log(moment().format('MMMM Do YYYY, hh:mm:ss a') + " Data Retrieved : " +JSON.stringify(data));
        console.log("--------------------------------------------------------");
        res.json(data);
    });
});

app.listen(4000, function(){
  console.log("--------------------------------------------------------");
  console.log(moment().format('MMMM Do YYYY, hh:mm:ss a') + " | System Retrieval API is ready to go");
  console.log("Try retrieving a system with : http://localhost:4000/bob/system?system=iib");
  console.log("--------------------------------------------------------");
});
