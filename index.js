const conf = require('./config').config;

var express        = require('express');
var session        = require('express-session');
var passport       = require('passport');
var OAuth2Strategy = require('passport-oauth').OAuth2Strategy;
var request        = require('request');
var handlebars     = require('handlebars');
var TwitchClient = require('twitch').default;
var PubSubClient = require('twitch-pubsub-client').default;

console.log(conf.TWITCH_CLIENT_ID);

var app = express();
app.use(session({secret: conf.SESSION_SECRET, resave: false, saveUninitialized: false}));
app.use(express.static('public'));
app.use(passport.initialize());
app.use(passport.session());

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
<html><head><title>Twitch Auth Sample</title></head>
<table>
    <tr><th>Access Token</th><td>{{accessToken}}</td></tr>
    <tr><th>Refresh Token</th><td>{{refreshToken}}</td></tr>
    <tr><th>Display Name</th><td>{{display_name}}</td></tr>
    <tr><th>Bio</th><td>{{bio}}</td></tr>
    <tr><th>Image</th><td>{{logo}}</td></tr>
</table></html>`);

app.get('/', function (req, res) {
    if(req.session && req.session.passport && req.session.passport.user) {

        console.log(req.session.passport.user);

        const accessToken = req.session.passport.user.accessToken;
        const twitchUserId = req.session.passport.user.id;

        const twitchClient = TwitchClient.withCredentials(conf.TWITCH_CLIENT_ID, accessToken, 'channel:read:redemptions');
        const pubSubClient = new PubSubClient();
        pubSubClient.registerUserListener(twitchClient, twitchUserId);
        pubSubClient.onRedemption(twitchUserId, (message) => {
            console.log(message.rewardName);
        }).then();

        res.send(template(req.session.passport.user));
    } else {
        res.send('<html><head><title>Twitch Auth Sample</title></head><a href="/auth/twitch"><img src="https://thumbs.dreamstime.com/z/people-try-to-connect-27095228.jpg"></a></html>');
    }
});
  
app.listen(3000, function () {
console.log('Twitch auth sample listening on port 3000!')
});