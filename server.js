const VERSION ="1.0.1";

const express = require('express')
const cors = require('cors')
const axios = require('axios')
const { response } = require('express')
const mongoose = require('mongoose')
const app = express()
const port = process.env.PORT || 8080

app.use(express.json())
app.use(express.urlencoded({
  extended: true
}))
app.use(cors())

// Connect to MongoDB.
console.log("Connecting to MongoDB database...");
mongoose.connect(process.env.MONGODB_URI, {useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true});
const db = mongoose.connection;
// On error...
db.on('error', console.error.bind(console, 'Connection error:'));

// On success...
db.once('open', function() {
    
    console.log("Connected to MongoDB database.\n");

    const gameSchema = new mongoose.Schema({
        // Games should be deleted when the host leaves so game IDs can be reused later.
        // While a game is active, the ID should be unique.
        gameID: { type: String, required: true, unique: true },
        nicknameHost: { type: String, required: true },
        nicknameGuest: { type: String },
        choiceHost: String,
        choiceGuest: String,
        readyHost: Boolean,
        readyGuest: Boolean,
        lastPingHost: Date,
        lastPingGuest: Date
    });

    const Game = mongoose.model('Game', gameSchema);
    
    // Routes.
    // Ignore favicon.
    app.get('/favicon.ico', (req, res) => res.status(204));
  
    // Default route.
    app.get('/', (req, res) => {
        res.status(200);
        res.send("Hello, world!");
    });

    // Get version.
    app.get('/version', (req, res) => {
        res.status(200);
        res.send(VERSION);
    });
  
    // Create game.
    app.post('/create/:nickname', async (req, res) => {
        
        let newGame = new Game();

        // Limit to 20 characters.
        const nickname = decodeURIComponent(req.params["nickname"]).substring(0, 20);
        console.log(`Received create game request for host ${nickname}.`);  
      
        // Generate a valid and unique game ID.
        let gameID = "";
        let queryRes = null;
        
        do {
            gameID = Math.floor(Math.random() * 9999).toString().padStart(4, "0");
            queryRes = await Game.findOne({gameID}).exec();
        } while (queryRes != null);
        
        newGame.gameID = gameID;
        newGame.nicknameHost = nickname;
        newGame.nicknameGuest = null;
        newGame.choiceHost = null;
        newGame.choiceGuest = null;
        newGame.readyHost = false;
        newGame.readyGuest = false;
        newGame.lastPingHost = Date.now();
        newGame.lastPingGuest = null;

        console.log(`Game ID ${gameID}: creating game for host '${nickname}'...`);
        
        // Save the game.
        newGame.save(function (err, result) {
            if (err) {
                console.log(err);
                res.status(500);
                res.send("error:could_not_create_game");
            }
        });

        res.status(201);
        res.send(newGame);
    });

    // Join game.
    app.get('/join/:gameID,:nickname', async (req, res) => {
        
        const gameID = req.params["gameID"];
        // Limit name to 20 characters.
        const nickname = decodeURIComponent(req.params["nickname"]).substring(0, 20);
        console.log(`Received request from ${nickname} to join game ${gameID}.`);
      
        const game = await Game.findOne({gameID}).exec();

        if (game != null) {
            
            if (game.nicknameGuest != null) {
                console.log(`Game ID ${gameID}: guest '${nickname}' tried to join a game that is already full.`);
                res.status(403);
                res.send("error:game_full");
                return;
            }

            game.nicknameGuest = nickname;
            game.choiceGuest = null;
            game.readyGuest = false;
            game.lastPingGuest = Date.now();
            game.save();
            
            console.log(`Game ID ${gameID}: guest '${nickname}' joined '${game.nicknameHost}'s game.`);
            res.status(200);
            res.send(game);

        } else {
            console.log(`Game ID ${gameID}: guest '${nickname}' tried to join a game that does not exist.`);
            res.status(404);
            res.send("error:game_does_not_exist");
        }
        
    });

    // Set a player's choice.
    app.post('/choice/:gameID,:isHost,:choice', async (req, res) => {
        
        const gameID = req.params["gameID"];
        const isHost = req.params["isHost"] == "true";
        const choice = req.params["choice"];

        const game = await Game.findOne({gameID}).exec();

        if (game != null) {
            
            if (isHost) {
                game.choiceHost = choice;
                console.log(`choiceGueste ID ${gameID}: host '${game.nicknameHost}' chose '${choice}'.`);
                game.lastPingHost = Date.now();
            } else {
                game.choiceGuest = choice;
                console.log(`Game ID ${gameID}: guest '${game.nicknameGuest}' chose '${choice}'.`);
                game.lastPingGuest = Date.now();
            }

            game.save();

            res.status(200);
            res.send(game);
            return;
            
        } else {
            res.status(404);
            res.send("error:game_does_not_exist");
        }

    });

    // Get the current state of the game.
    app.get('/getState/:gameID,:isHost', async (req, res) => {

        const gameID = req.params["gameID"];
        const isHost = req.params["isHost"] == "true";
        const game = await Game.findOne({gameID}).exec();

        if (game != null) {

            // Update the last ping date.
            // If one of the players has timed out, remove them (or delete the game).
            if (isHost) {
                game.lastPingHost = Date.now();

                // 5 seconds timeout
                // If the guest timed out...
                if (Date.now() - game.lastPingGuest > 5000) {
                    game.nicknameGuest = null;
                    game.readyHost = false;
                    game.readyGuest = false;
                    game.choiceHost = null;
                    game.choiceGuest = null;
                    game.lastPingHost = Date.now();
                    game.lastPingGuest = null;
                }

            } else {
                game.lastPingGuest = Date.now();

                // 5 seconds timeout
                // If the host timed out...
                if (Date.now() - game.lastPingHost > 5000) {
                    game.deleteOne();
                    res.status(200);
                    res.send("player_left");
                    return;
                }
            }

            game.save();

            res.status(200);
            res.send(game);

        } else {
            res.status(404);
            res.send("error:game_does_not_exist");
        }

    });

    // Update the state of the player (ready for next round, exit).
    app.post(`/playerStatus/:gameID,:isHost,:status`, async (req, res) => {

        const gameID = req.params["gameID"];
        const isHost = req.params["isHost"] == "true";
        const status = req.params["status"];
        const game = await Game.findOne({gameID}).exec();

        if (game != null) {

            if (status == "ready") {
                if (isHost) {
                    game.readyHost = true;
                    game.lastPingHost = Date.now();
                } else {
                    game.readyGuest = true;
                    game.lastPingGuest = Date.now();
                }

                if (game.readyHost && game.readyGuest) {
                    game.readyHost = false;
                    game.readyGuest = false;
                    game.choiceHost = null;
                    game.choiceGuest = null;
                }

            } else if (status == "exit") {
                if (isHost) {
                    game.deleteOne();
                    res.status(200);
                    res.send("player_left");
                    return;
                } else {
                    game.nicknameGuest = null;
                    game.readyHost = false;
                    game.readyGuest = false;
                    game.choiceHost = null;
                    game.choiceGuest = null;
                    game.lastPingHost = Date.now();
                    game.lastPingGuest = null;
                }
            }

            game.save();
            res.status(200);
            res.send(game);

        } else {
            res.status(404);
            res.send("error:game_does_not_exist");
        }
    });

    app.listen(port);

}); // end of on successful connection to MongoDB
