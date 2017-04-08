//Add the modules that are required
var restify = require('restify');
var builder = require('botbuilder');
var unirest = require('unirest');
var LUIS = require('luis-sdk');
var moment = require('moment');
var ping = require("ping");

const APP_ID = '<LUIS_APP_ID>';
const APP_KEY = 'LUIS_APP_PWD';

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function() {
    console.log("--------------------------------------------------------");
    console.log(moment().format('MMMM Do YYYY, hh:mm:ss a') + " | Backoffice Bot is running with the address : " + server.url);
    console.log("--------------------------------------------------------");
});

// Create chat bot
var connector = new builder.ChatConnector({
    appId: "<app-id>",
    appPassword: "<app-pwd>"
});

var bot = new builder.UniversalBot(connector);

var model = '<luis-published-model-url>';
var recognizer = new builder.LuisRecognizer(model);
var dialog = new builder.IntentDialog({
    recognizers: [recognizer]
});

server.post('/api/messages', connector.listen());

//=========================================================
// Bots Dialogs
//=========================================================

bot.dialog('/', dialog);

dialog.matches('intent.Greetings', [
    function(session, args) {
        console.log("--------------------------------------------------------");
        console.log(moment().format('MMMM Do YYYY, hh:mm:ss a') + " | Greetings Intent Matched");
        console.log("--------------------------------------------------------");
        session.send("Hi, I'm Bob! How can I help you today?");
    }
]);

console.log("--------------------------------------------------------");
console.log(moment().format('MMMM Do YYYY, hh:mm:ss a') + " | Capabilities Intent Matched");
console.log("--------------------------------------------------------");

dialog.matches('intent.Capabilities', [
    function(session, args) {
        session.send("I can help with conducting health checks for your systems!");
    }
]);

dialog.matches('intent.ThankYou', [
    function(session, args) {
        console.log("--------------------------------------------------------");
        console.log(moment().format('MMMM Do YYYY, hh:mm:ss a') + " | Thank You Intent Matched");
        console.log("--------------------------------------------------------");
        session.send("Your welcome, have a great day!");
    }
]);

dialog.matches('intent.NoHelp', [
    function(session, args) {
        console.log("--------------------------------------------------------");
        console.log(moment().format('MMMM Do YYYY, hh:mm:ss a') + " | No Help Intent Matched");
        console.log("--------------------------------------------------------");
        session.send("Have a great day!");
    }
]);

dialog.matches('intent.HealthCheck', [
    function(session, args) {
        console.log("--------------------------------------------------------");
        console.log(moment().format('MMMM Do YYYY, hh:mm:ss a') + " | Health Check Intent Matched");
        console.log("--------------------------------------------------------");
        var sys = "";
        var env = "";
        //Start HealthCheck Dialog and Pass Entities Array to it
        session.send("Sure, I can help you run a health check");
        if (args.entities.length == 0) {
            //Start Dialog Flow for asking individual items
            entities = {
                "sys": "",
                "env": ""
            };
        } else {
            //Go through Entities array and check for available entities
            for (i = 0; i < args.entities.length; i++) {
                if (args.entities[i].type.includes("Systems")) {
                    sys = args.entities[i].type.substr(9);
                } else if (args.entities[i].type.includes("Environment")) {
                    env = args.entities[i].type.substr(13);
                }
            }

            entities = {
                "sys": sys,
                "env": env
            };
        }

        session.beginDialog('/healthCheck', entities);
    },
    function(session, args, next) {
        //Retrieve System Details from the DB Instance
        unirest.get("http://localhost:4000/bob/system?system=" + args.sys).end(function(response, error) {
            if (error) {
                session.endDialog("I was unable to retrieve the system details");
            } else {
                var url = "";

                //Check environment
                if (args.env == "Development") {
                    url = response.body[0].dev;
                } else if (args.env == "Test") {
                    url = response.body[0].test;
                } else if (args.env == "QA") {
                    url = response.body[0].qa;
                } else if (args.env == "Production") {
                    url = response.body[0].prod;
                }

                if (url == "") {
                    session.endDialog("I was not able to retrieve the endpoint for " + args.sys + " - " + args.env);
                } else {
                    session.sendTyping();
                    //Ping system and check health
                    ping.promise.probe(url, {
                        timeout: 5,
                    }).then(function(isAlive) {
                      console.log("--------------------------------------------------------");
                      console.log(moment().format('MMMM Do YYYY, hh:mm:ss a') + " | Ping Result for "+url+" is "+JSON.stringify(isAlive));
                      console.log("--------------------------------------------------------");
                        if (isAlive.alive) {
                            session.endDialog(args.sys + " - " + args.env + " is currently healthy with response time of "+isAlive.avg+" ms");
                        } else {
                            session.endDialog(args.sys + " - " + args.env + " is currently not reachable");
                        }
                    });
                }

            }
        });
    }
]);

bot.dialog('/healthCheck', [
    function(session, args, next) {
        if (args.sys == "") {
            session.beginDialog('/askSys', {
                "sys": args.sys,
                "env": args.env
            });
        } else {
            next(args);
        }
    },
    function(session, args, next) {
        if (args.env == "") {
            session.beginDialog('/askEnv', {
                "sys": args.sys,
                "env": args.env
            });
        } else {
            next(args);
        }
    },
    function(session, args, next) {
        //Store SYS and ENV in Session Data
        session.dialogData.sys = args.sys;
        session.dialogData.env = args.env;

        //Handle Confirmation from User
        builder.Prompts.confirm(session, "Please confirm(yes/no) that you would like to run a health check for " + args.sys + " - " + args.env);
    },
    function(session, args, next) {
        if (args.response) {
            //Send back to the caller process
            args.sys = session.dialogData.sys;
            args.env = session.dialogData.env;
            next(args);
        } else {
            session.replaceDialog('/healthCheck', {
                "sys": "",
                "env": ""
            });
        }
    }
]);

bot.dialog('/askSys', [
    function(session, args) {
        //Set args into Session Dialog Data
        session.dialogData.env = args.env;

        //Check for redo variable
        if (args && args.reprompt) {
            builder.Prompts.text(session, "I was not able to identify that system, please try again.");
        } else {
            builder.Prompts.text(session, "What system would you like to run a health check for?");
        }
    },
    function(session, args) {
        //Extract the System Entity
        var sysText = args.response;
        extractEntity(sysText, function(result) {
            //Set args data with session data
            args.env = session.dialogData.env;

            //Check if system was extracted
            if (result.sys != "") {
                args.sys = result.sys;
                session.endDialogWithResult(args);
            } else {
                //Replace Dialog and run the prompt again
                session.replaceDialog('/askSys', {
                    "sys": "",
                    "env": args.env,
                    "reprompt": true
                });
            }
        });
    }
]);

bot.dialog('/askEnv', [
    function(session, args) {
        //Set args into Session Dialog Data
        session.dialogData.sys = args.sys;

        //Check for redo variable
        if (args && args.reprompt) {
            builder.Prompts.text(session, "I was not able to identify that environment, please try again.");
        } else {
            builder.Prompts.text(session, "What environment would you like to run a health check for?");
        }
    },
    function(session, args) {
        //Extract the System Entity
        var envText = args.response;
        extractEntity(envText, function(result) {
            //Set args data with session data
            args.sys = session.dialogData.sys;

            //Check if system was extracted
            if (result.env != "") {
                args.env = result.env;
                session.endDialogWithResult(args);
            } else {
                //Replace Dialog and run the prompt again
                session.replaceDialog('/askEnv', {
                    "sys": args.sys,
                    "env": "",
                    "reprompt": true
                });
            }
        });
    }
]);

dialog.onDefault(builder.DialogAction.send("I'm sorry I didn't understand. I'm the Backoffice Bot, how can I help you? "));

//Identify and Extract the entity
function extractEntity(message, callback) {
    //Get the prediction from LUIS
    predictLanguage(message, function(prediction) {
        var intent = sortHighestIntent(prediction);
        var sys = "";
        var env = "";

        if (intent == "intent.IdentifyEntity") {
            //Extract the entities
            for (i = 0; i < prediction.EntitiesResults.length; i++) {
                if (prediction.EntitiesResults[i].name.includes("Systems")) {
                    sys = prediction.EntitiesResults[i].name.substr(9);
                } else if (prediction.EntitiesResults[i].name.includes("Environment")) {
                    env = prediction.EntitiesResults[i].name.substr(13);
                }
            }

            callback({
                "sys": sys,
                "env": env
            });
        } else {
            callback({
                "sys": sys,
                "env": env
            });
        }
    });
}

//Use LUIS to identify intents and entities
function predictLanguage(message, callback) {
    var url = 'https://westus.api.cognitive.microsoft.com/luis/v1.0/prog/apps/' + APP_ID + '/predict?example=' + message;
    //Retrive the top scoring intents and entities
    unirest.get(url)
        .headers({
            'Ocp-Apim-Subscription-Key': APP_KEY
        })
        .end(function(response) {
            callback(response.body);
        });
}

//Sort and return the highest score prediction
function sortHighestIntent(prediction) {
    var score = 0;
    var intent = "";
    var i;
    //Check for Entity Extraction
    for (i = 0; i < prediction.IntentsResults.length; i++) {
        if (prediction.IntentsResults[i].score > score) {
            score = prediction.IntentsResults[i].score;
            intent = prediction.IntentsResults[i].Name;
        }
    }

    return intent;
}
