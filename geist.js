"use strict";

var document = require("global/window");
var window = require("global/window");
var rsvp = require('rsvp');
var _ = require('eakwell');

var Mind = function(name, options) {
  options = _.deepMerge({
    name: name,
    language: (document.documentElement && document.documentElement.lang) || 'en-US',
    relisten: true,
    continuous: true,
    proactive: true,
    memoryDuration: 30, // seconds
    suppressSelflisten: false,

    personality: {
      gender: 'female',
      humor: 0.5,
      cynicism: 0.1,
      confidence: 0.9,
      honesty: 0.9,
      empathy: 0.8,
      agression: 0.1,
      dreaminess: 0.4,
      anxiousness: 0.4,
      cheerfulness: 0.75,
      slopyness: 0.1,
      laziness: 0.1
    },

    concepts: {
      TOD: ["morning | afternoon | evening | night", function() {
        // Current time of day
        var hours = new Date().getHours();
        if(hours < 12)       return 'morning';
        else if(hours <= 16) return 'afternoon';
        else if(hours <= 22) return 'evening';
        else                 return 'night';
      }],

      INSULT: [function(text) {
        var m;
        // Check for curse words censored by the recognition engine
        if(m = text.match(/(\w\*+)([^\*]*(\w\*+))?/g)) {
          // return only the first multi word insult
          return m[0];
        } else {
          // Return the first insult that matches
          return _.any(insults, function(insult) {
            if(_.contains(text, insult)) {
              return insult;
            }
          });
        }
      }, function() {
        // Random insult
        return _.pick(insults);
      }],

      JOKE: [undefined, function() {
        // Random joke
        return _.pick(jokes);
      }],

      NOUN: [function(text) {
        return true;
      }, function() {
        return 'some noun';
      }]
    },

    emotions: {
      SAD: function(text) {
        return {
          speed: 0.8,
          pitch: 0.7
        }
      }
    },

    actions: {
      VIBRATE: function() {
        if(window.navigator.vibrate) navigator.vibrate([200, 100, 200]);
      },
      TRANSLATE: function(text, language) {
        return self.translate(text, options.language, language);
      }
    },

    conversation: {
      "(Hi | Hello | Good {$time: #TOD}) [#NAME] [...]" : "(Hello | Good ($time | #TOD)), #HUMAN! ...",
      "Open #ARTICLE [<#ADJECTIVE>] [pod bay] door[s]" : "I'm sorry, #HUMAN. %SAD(I'm afraid I can't do that)",
      "[...] you {$insult: #INSULT}." : "... #PAUSE [Why $insult? | %RIDICULE(#INSULT) | %SAD(That wasn't neccessary!)]",
      "Translate {$text: *} into {$language: *}" : "In $language that's: %SILENT(!TRANSLATE($text, $language))",
      "[(Send | write | new) [a]] message to {$person: *}" : { "What message would you like to send to $person?" : {
        "{$message: *}" : { "Shall is send \"$message \" to $person?" : {
          "#YES" : "!SMS($person, $message) It's out!",
          "#NO" : "Sorry, <-",
          "#CANCEL" : "Ok, not sending it. <--"
        }}
      }},
      "(Tell [me] | [Do] you know) a joke" : "#JOKE",
      "Thank('s | you)" : "You're welcome! | No problem[o]!",
      "*" : "Excuse me!? | Can you please repeat that, #HUMAN?"
    }
  }, options);

  var tokenize = function(template) {
    return _.map(template.trim().split(' '), function(token) {
      return {
        type: 'word',
        word: token.replace('?', '')
      };
    });
  };

  var match = function(text, template) {
    var words = tokenize(text);
    var tokens = tokenize(template);
    var count;
    return count = _.count(tokens, function(token, i) {
      var word = words[i];
      if(token && token.type == 'word') {
        return token.word.toLowerCase() == word.word.toLowerCase();
      }
    }) && {
      values: {},
      score: count
    };
  };

  var resolveAnswer = function(values, template) {
    return template;
  };

  var process = function(text) {
    // Translate to english first
    return translate(text, options.language, 'en-US').then(function(text) {
      // Retrieve best-matching question template
      var question = _.each(options.conversation, function(at, qt) {
        var m = match(text, qt);
        return m && {
          values: m.values,
          answerTemplate: at
        }
      });
      if(question) {
        // Resolve to one definite answer
        var ssml = resolveAnswer(question.values, question.answerTemplate);
        // Translate back instance's language and speak
        return translate(ssml, 'en-US', options.language).then(function(ssml) {
          self.speak(ssml);
          // Return simple text to interrested listeners
          return ssml;
        });
      } else {
        console.error("Could not understand: " + text);
      }
    });
  };

  var listening = false;

  var self = {
    speak: function(text, language) {
      return _.promise(function(ok, fail) {
        if(!('speechSynthesis' in window)) return fail('Browser does not support speech synthesis');
        var ut = new SpeechSynthesisUtterance();
        ut.volume = 1; // 0 to 1
        ut.rate = 0.9; // 0.1 to 10
        ut.pitch = 0.8; // 0 to 2
        ut.lang = language || options.language;
        ut.text = text;
        var voices = voicesForLanguage(ut.lang, true);
        ut.voice = voices[0];
        // ut.voiceURI = 'native';
        ut.onend = function(e) {
          console.log('Finished in ' + e.elapsedTime + ' seconds.');
          ok(text);
        };
        ut.onerror = function(e) {
          fail(e.message || e.error);
        };
        ut.onstart = function() {
          console.log('speaking');
        };
        // Don't listen to own voice
        var suppress = listening && options.suppressSelflisten;
        if(suppress) listening.stop();
        speechSynthesis.speak(ut);
        if(suppress) listening.start();
      });
    },

    listen: function(interimCb, finalCb, answerCb) {
      if(!('webkitSpeechRecognition' in window)) return console.error('Browser does not support speech recognition');
      self.stop();
      var rec = new webkitSpeechRecognition();
      rec.interimResults = true;
      rec.lang = options.language;
      rec.continuous = options.continuous;
      rec.onresult = function(e) {
        var interimTranscript = '';
        var finalTranscript = '';
        // Assemble transcripts
        for(var i = e.resultIndex; i < e.results.length; ++i) {
          if(e.results[i].isFinal) {
            finalTranscript += e.results[i][0].transcript;
          } else {
            interimTranscript += e.results[i][0].transcript;
          }
        }
        // Interim callback
        interimCb && interimCb(interimTranscript);
        if(finalTranscript) {
          // Stop manually to work around chrome bug
          if(!rec.continuous) rec.stop();
          // Final question text callback
          finalCb && finalCb(finalTranscript);
          // Generate and speak answer text
          process(finalTranscript).then(function(answer) {
            // Answer callback
            answerCb && answerCb(answer);
          });
          finalTranscript = '';
        }
      };
      rec.onstart = function() {
        console.log("Listening...");
        listening = rec;
      };
      rec.onend = function() {
        console.log("Listening stopped by engine");
        // Restart when engine terminates in continuous mode
        if(rec.continuous && listening) {
          console.log("Restarting");
          rec.start();
        } else {
          listening = false;
        }
      };
      rec.onerror = function(e) {
        listening = false;
        console.error(e.message || e.error);
      }
      // Start listening
      rec.start();
    },

    // Stop listening and talking immediately
    stop: function() {
      if(!listening) return;
      listening = false;
      listening.stop();
      speechSynthesis.cancel();
    },

    // Translate and speak the given text
    translate: function(text, from, to) {
      to = to || options.language;
      return translate(text, from, to).then(function(translation) {
        self.speak(translation, to);
        return translation;
      });
    }
  };
  return self;
};

var translate = function(text, from , to) {
  if(from == to) return _.promiseFrom(text);
  var url = encodeURI('/translate?text=' + text + '&from=' + from + '&to=' + to);
  return _.ajax('GET', url, {}).then(function(body) {
    return body.responseData.translatedText;
  });
};

var voicesForLanguage = function(lang, localOnly) {
  if(!('speechSynthesis' in window)) return [];
  var voices = speechSynthesis.getVoices();
  return _.select(voices, function(voice) {
    return voice.lang == lang && (voice.localService || !localOnly);
  });
};
// Request voices immediately to work around bug in chrome
// https://code.google.com/p/chromium/issues/detail?id=340160
voicesForLanguage();

var insults = ['idiot'];
var jokes = [
  'A sandwich walks into a bar. The barman says "Sorry, we don\'t serve food in here."',
  'Four fonts walk into a bar, the barman says "Oi - get out! We don\'t want your type in here."',
  'A dyslexic man walks into a bra.',
  'There\'s two fish in a tank, and one says "How do you drive this thing?".',
  'Two aerials meet on a roof - fall in love - get married. The ceremony was rubbish - but the reception was brilliant.'
];

module.exports = {Mind: Mind};
