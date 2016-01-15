'use strict';

var express = require('express'),
  app = express(),
  bluemix = require('./config/bluemix'),
  watson = require('watson-developer-cloud-alpha'),
  extend = require('util')._extend,
  fs = require('fs'),
  errorhandler = require('errorhandler'),
  bodyParser   = require('body-parser');
  

// Database setup
var mongo = require('mongodb');
var monk = require('monk');
var database = monk('database connection string');

// Configure Express
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Setup static public directory
app.use(express.static(__dirname + '/../public'));
app.set('view engine', 'jade');
app.set('views', __dirname + '/../views');

// Let the db see the router
app.use(function(req,res,next){
    req.db = database;
    next();
});

// Bootstrap application settings 
require('./config/express')(app);

// Bluemix Creds
var credentials = extend({
    version: 'v2',
    url: 'https://gateway.watsonplatform.net/personality-insights/api',
    username: '',
    password: ''
}, bluemix.getServiceCreds('personality_insights')); // VCAP_SERVICES

// Create the service wrap & dummy text from file
var personalityInsights = new watson.personality_insights(credentials);
var dummy_text = fs.readFileSync('default-text.txt');

// render index page
app.get('/', function(req, res) {
  res.render('index', { 
    content: dummy_text 
  });
});

app.post('/', function(req, res) {
  personalityInsights.profile(req.body, function(error, profile) {
    console.log(req.body.inputName + req.body.inputEmail + req.body.inputLocation);
    var inputName = req.body.inputName;
    var inputEmail = req.body.inputEmail;
    var inputLocation = req.body.inputLocation;
    if (error) {
      if (error.message){
        error = { error: error.message };
      }
      return res.status(error.code || 500).json(error || 'Oops, we seem to have had a problem processing...');
    }
    else
      var db = req.db;
      var collection = db.get('personalitycollection');
      collection.insert({
        "name" : inputName,
        "email" : inputEmail,
        "location" : inputLocation,
        "profile" : profile,
      }
      );
      return res.json(profile)
  });
});

var port = process.env.VCAP_APP_PORT || 3000;
app.listen(port);
console.log('listening at: ', port);