'use strict';

var express = require('express'),
  app = express(),
  bluemix = require('./config/bluemix'),
  watson = require('watson-developer-cloud-alpha'),
  extend = require('util')._extend,
  fs = require('fs'),
  errorhandler = require('errorhandler'),
  bodyParser   = require('body-parser');



  
/* Moving to Cloudant
// Database setup
var mongo = require('mongodb');
var monk = require('monk');
var database = monk('database connection string');
      "plan": "Shared",
      ...
*/

// Cloudant Database Connection
var db;
var cloudant;
var dbCredentials={
  dbName : ""
};

require('dotenv').load();

dbCredentials.dbName = process.env.dbCredentialsName;
console.log('dbName: ' + dbCredentials.dbName);

function initDBConnection() {
  
  if(process.env.VCAP_SERVICES) {
    var vcapServices = JSON.parse(process.env.VCAP_SERVICES);
    if(vcapServices.cloudantNoSQLDB) {
      dbCredentials.host = vcapServices.cloudantNoSQLDB[0].credentials.host;
      dbCredentials.port = vcapServices.cloudantNoSQLDB[0].credentials.port;
      dbCredentials.user = vcapServices.cloudantNoSQLDB[0].credentials.username;
      dbCredentials.password = vcapServices.cloudantNoSQLDB[0].credentials.password;
      dbCredentials.url = vcapServices.cloudantNoSQLDB[0].credentials.url;

      cloudant = require('cloudant')(dbCredentials.url);
      
      // check if DB exists if not create
      cloudant.db.create(dbCredentials.dbName, function (err, res) {
        if (err) { console.log('could not create db ', err); }
        });
      
      db = cloudant.use(dbCredentials.dbName);
      
    } else {
      console.warn('Could not find Cloudant credentials in VCAP_SERVICES environment variable - data will be unavailable to the UI');
    }
  } else{
    
    dbCredentials.host = process.env.dbCredentialsHost;
    dbCredentials.port = process.env.dbCredentialsPort;
    dbCredentials.user = process.env.dbCredentialsUser;
    dbCredentials.password = process.env.dbCredentialsPassword;
    dbCredentials.url = process.env.dbCredentialsUrl;
    console.log('Environment variable set from local .env');

    cloudant = require('cloudant')(dbCredentials.url);
      
      // check if DB exists if not create
      cloudant.db.create(dbCredentials.dbName, function (err, res) {
        if (err) { console.log('could not create db, it may already exit'); }
        });
      
      db = cloudant.use(dbCredentials.dbName);
  }
}

initDBConnection();

var saveProfile = function(name, email, location, profile) {
  if (db) {
    db.insert({
      name : name,
      email : email,
      location: location,
      profile: profile,
    }, function(err, doc) {
      if(err) {
        console.log('Database had an isse:' + err);
      }
    }); 
  console.log('New Database entry: ' + name);
  }
  else{
    console.log('tried to save but no db exists...');
  }
}



// Configure Express
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Setup static public directory
app.use(express.static(__dirname + '/../public'));
app.set('view engine', 'jade');
app.set('views', __dirname + '/../views');

// Let the db into the router
app.use(function(req,res,next){
    req.db = db;
    next();
});

// Bootstrap application settings 
require('./config/express')(app);

// Bluemix Creds
var bluemixCreds = {
  version : ""
};

bluemixCreds.version = process.env.BMversion;
bluemixCreds.version = process.env.BMversion;
bluemixCreds.url = process.env.BMurl;
bluemixCreds.username = process.env.BMusername;
bluemixCreds.password = process.env.BMpassword;

var credentials = extend(bluemixCreds, bluemix.getServiceCreds('personality_insights')); // VCAP_SERVICES

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
      try {
      saveProfile(inputName, inputEmail, inputLocation, profile);
    } catch (e){
      console.warn('Error Writing to the DB');
    }
      return res.json(profile)
    }
  );
});



var port = process.env.VCAP_APP_PORT || 3000;
app.listen(port);
console.log('listening at: ', port);