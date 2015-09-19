# Geist
[![npm version](https://badge.fury.io/js/geist.svg)](http://badge.fury.io/js/geist) [![Build Status](https://travis-ci.org/syntheticore/geist.svg?branch=master)](https://travis-ci.org/syntheticore/geist) [![Dependency Status](https://david-dm.org/syntheticore/geist.svg)](https://david-dm.org/syntheticore/geist) [![Code Climate](https://codeclimate.com/github/syntheticore/geist/badges/gpa.svg)](https://codeclimate.com/github/syntheticore/geist)

Build virtual assistants for the web

Designed for use with Browserify

## Installation

    npm install geist --save

## Usage

  ```JavaScript
  var geist = require('geist');

  // Describe your assistant
  var hal = new geist.Mind('HAL 9000', {
    // Language is taken from the document if not specified here
    language: 'en-US',
    // Keep listening all the time if you like
    continuous: true,
    // Define generic concepts for recognition and/or answer text generation
    // You can either use template strings or functions to determine a match
    concepts: {
      TOD: ["morning | afternoon | evening | night", function() {
        // Current time of day
        var hours = new Date().getHours();
        if(hours < 12)       return 'morning';
        else if(hours <= 16) return 'afternoon';
        else if(hours <= 22) return 'evening';
        else                 return 'night';
      }],
      JOKE: [undefined, function() {
        // Random joke
        return _.pick(jokes);
      }]
    },
    // Define your action handlers
    actions: {
      MESSAGE: function(person, text) {
        // Send message...
      }
    },
    // Build the actual conversation
    conversation: {
      // Use alternatives to make recognition flexible and output diverse
      "Thank('s | you)" : "You're welcome! | No problem!",
      // Reference general concepts in your conversation and influence TTS using emotions
      "Open #ARTICLE * [pod bay] door[s]" : "I'm sorry, #HUMAN. %SAD(I'm afraid I can't do that)",
      // Create your own concepts and reference them
      "(Tell [me] | [Do] you know) a joke" : "How about this one: #JOKE",
      // Allow greetings before other text and greet back before continuing
      "(Hi | Hello | Good #TOD) [#NAME] [...]" : "(Hello | Good #TOD), #HUMAN! ...",
      // Use $variables to extract information
      "[(Send | write | new) [a]] message to {$person: *}" : { "What message would you like to send to $person?" : {
        // Drill down into conversations to retrieve additional information
        "{$message: *}" : { "Shall is send \"$message \" to $person?" : {
          // Call action handler
          "#YES" : "!MESSAGE($person, $message) It's out!",
          // Ask for the message again
          "#NO" : "Sorry, <-",
          // Back to top level
          "#CANCEL" : "Ok, not sending it. <--"
        }}
      }},

      // Make sure at least one phrase catches everything
      "*" : "Excuse me!? | Can you please repeat that, #HUMAN?"
    }
  });

  // Start listening to the users voice
  // The user will be asked for access to her microphone
  hal.listen(function(interimText) {
    // Visualize speech recognition process..
  }, function(text) {
    // Show final recognized text...
  }, function(answer) {
    // (Answer is being spoken using TTS)
    // Display answer as well if you like...
  });

  // Stop speaking and listening immediately
  hal.stop();
  ```

## License

  MIT
