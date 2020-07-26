const conf = require('./config').config;

var express        = require('express');
var session        = require('express-session');
var passport       = require('passport');
var OAuth2Strategy = require('passport-oauth').OAuth2Strategy;
var request        = require('request');
var handlebars     = require('handlebars');
var TwitchClient = require('twitch').default;
var PubSubClient = require('twitch-pubsub-client').default;
var StaticAuthProvider = require('twitch').StaticAuthProvider;
var RefreshableAuthProvider = require('twitch').RefreshableAuthProvider;
var tmi            = require('tmi.js');

var app = express();
app.use(session({secret: conf.SESSION_SECRET, resave: false, saveUninitialized: false}));
app.use(express.static('public'));
app.use(passport.initialize());
app.use(passport.session());

// Define configuration options
const opts = {
  identity: {
    username: conf.BOT_USERNAME,
    password: conf.BOT_OAUTH_SECRET
  },
  channels: [
    conf.CHANNEL_NAME
  ]
};

// Create a client with our options
const client = new tmi.client(opts);

// Register our event handlers (defined below)
client.on('message', onMessageHandler);
client.on('connected', onConnectedHandler);

client.connect();

OAuth2Strategy.prototype.userProfile = function(accessToken, done) {
    var options = {
      url: 'https://api.twitch.tv/helix/users',
      method: 'GET',
      headers: {
        'Client-ID': conf.TWITCH_CLIENT_ID,
        'Accept': 'application/vnd.twitchtv.v5+json',
        'Authorization': 'Bearer ' + accessToken
      }
    };
    request(options, function (error, response, body) {
      if (response && response.statusCode == 200) {
        done(null, JSON.parse(body));
      } else {
        done(JSON.parse(body));
      }
    });
}

passport.serializeUser(function(user, done) {
    done(null, user);
});

passport.deserializeUser(function(user, done) {
    done(null, user);
});

passport.use('twitch', new OAuth2Strategy({
    authorizationURL: 'https://id.twitch.tv/oauth2/authorize',
    tokenURL: 'https://id.twitch.tv/oauth2/token',
    clientID: conf.TWITCH_CLIENT_ID,
    clientSecret: conf.TWITCH_SECRET,
    callbackURL: conf.CALLBACK_URL,
    state: true
  },
  function(accessToken, refreshToken, profile, done) {
    profile.accessToken = accessToken;
    profile.refreshToken = refreshToken;

    // Securely store user profile in your DB
    //User.findOrCreate(..., function(err, user) {
    //  done(err, user);
    //});

    done(null, profile);
  }
));

app.get('/auth/twitch', passport.authenticate('twitch', { scope: 'channel:read:redemptions' }));

app.get('/auth/twitch/callback', passport.authenticate('twitch', { successRedirect: '/', failureRedirect: '/' }));

var template = handlebars.compile(`
`);

app.get('/', async function (req, res) {
    if(req.session && req.session.passport && req.session.passport.user) {

        const accessToken = req.session.passport.user.accessToken;
        const refreshToken = req.session.passport.user.refreshToken;

        //messy but it gets the number correctly
        const twitchUserId = req.session.passport.user.data[0].id;

        //create the authprovider
        const authProvider = new RefreshableAuthProvider(
          new StaticAuthProvider(conf.TWITCH_CLIENT_ID, accessToken),
          {
            secret: conf.TWITCH_SECRET,
            refreshToken,
            onRefresh: (token) => {
              // do things with the new token data, e.g. save them in your database
            }
          }
        );

        //create Client with new AuthProvider
        const twitchClient = new TwitchClient({authProvider});
        const pubSubClient = new PubSubClient();

        //await waits for a Promise to be fulfilled or rejected.
        //https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await
        await pubSubClient.registerUserListener(twitchClient, twitchUserId);

        const listener = await pubSubClient.onRedemption(twitchUserId, (message) => {
          console.log(message.rewardName);
        });

        res.send(template(req.session.passport.user));
    } else {
        res.send('<html><head><title>Twitch Auth Sample</title></head><a href="/auth/twitch"><img src="https://thumbs.dreamstime.com/z/people-try-to-connect-27095228.jpg"></a></html>');
    }
});
  
app.listen(3000, function () {
  console.log('Page up on localhost:3000')
});

function onChannelPointReward(rewardName) {
  if (rewardName == 'Timeout Joey') {
    onTimeoutJoey();
    console.log('Joey Timed Out');
  } else if (rewardName == 'Timeout Thomas') {
    onTimeoutThomas();
    console.log('Thomas Timed Out');
  }
}

function onMessageHandler (target, context, msg, self) {
  if (self) { return; } // Ignore messages from the bot

  // Remove whitespace from chat message
  const commandName = msg.trim();

  // If the command is known, let's execute it
  if (commandName === '!dice') {
      const num = rollDice();
      client.say(target, `You rolled a ${num}`);
      console.log(`* Executed ${commandName} command`);
  } else {
      console.log(`* Unknown command ${commandName}`);
  }
}

function rollDice () {
  const sides = 6;
  return Math.floor(Math.random() * sides) + 1;
}

function onConnectedHandler (addr, port) {
  console.log(`* Connected to ${addr}:${port}`);
}

function onTimeoutJoey() {
  var timeoutTime = 600;
  var joeyUsername = 'N7_fishy';
  client.timeout(conf.CHANNEL_NAME, joeyUsername, timeoutTime, ":)");
  client.say(conf.CHANNEL_NAME, joeyUsername + " has been timed out for " + timeoutTime + " seconds.")
}

function onTimeoutThomas() {
  var timeoutTime = 600;
  var thomasUsername = 'maligoze';
  client.timeout(conf.CHANNEL_NAME, thomasUsername, timeoutTime, ":)");
  client.say(conf.CHANNEL_NAME, thomasUsername + " has been timed out for " + timeoutTime + " seconds.")
}
