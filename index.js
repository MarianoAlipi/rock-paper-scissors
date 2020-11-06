let gameID = -1;
let isHost = false;
let gameState = null;
// This flag is false while the host is alone in the lobby or
// the guest hasn't joined any game. When it detects a change of
// gameState (from null to something), this flag should activate
// to show a notification of who joined.
let opponentJoined = false;
let guestName = "";
let ended = false;
// A match ended and the player clicked 'play again'.
// The player is now waiting for the opponent to choose
// 'play again' or to leave.
let waitingToRestart = false;

const ADDRESS = "localhost";
const PORT = "8080";

const outcomes = {
    'rock': {
        'paper': false,
        'scissors': true
    },
    'paper': {
        'rock': true,
        'scissors': false
    },
    'scissors': {
        'rock': false,
        'paper': true
    }
};

// Handler for the 'create game' action.
let create_game_handler = (_) => {

    const nicknameField = document.getElementById("create-nickname");
    const nickname = nicknameField.value.trim();

    nicknameField.value = "";
    nicknameField.focus();
    nicknameField.select();

    // If the field is empty, cancel.
    if (nickname.length == 0) {
        nicknameField.classList.add("is-invalid");
        nicknameField.setAttribute("placeholder", "Enter a nickname");
        return;
    }

    axios
    .post(`http://${ADDRESS}:${PORT}/create/${nickname}`) 
    .then(resp => {

        if (resp.status == 201) {
            gameState = resp.data;
            gameID = gameState.gameID;
            isHost = true;
            console.log("Game ID: " + gameID);
            updateUI();

            $('#lonely').fadeIn();
            document.querySelector("#lonely").classList.add("d-flex");
            document.querySelector("#lonely").classList.remove("d-none");

            setTimeout(function() {
                get_game_state()
            }, 1000);

        } else {
            console.log(resp);
        }
        
        return;

    }).catch(function(error) {
        console.log(error);
        swal({
            title: "An error ocurred.",
            icon: "error",
            text: "Check the browser console for more information. 🤓",
            buttons: false,
            timer: 2500
        });
    });
}
    
// Handler for the 'join game' action.
let join_game_handler = (_) => {
    
    const nicknameField = document.getElementById("join-nickname");
    const gameIDField = document.getElementById("join-id");
    const nickname = nicknameField.value.trim();
    const gameIDToJoin = gameIDField.value.trim();
    
    // If the fields are empty, cancel.
    if (nickname.length == 0) {
        nicknameField.classList.add("is-invalid");
        nicknameField.setAttribute("placeholder", "Enter a nickname");
    }
    
    if (gameIDToJoin.length != 4) {
        gameIDField.classList.add("is-invalid");
        
        if (nickname.length == 0) {
            nicknameField.focus();
            nicknameField.select();
        } else {
            gameIDField.focus();
            gameIDField.select();
        }
    }

    if (nickname.length == 0 || gameIDToJoin.length == 0) {
        return;
    }
    
    axios
    .get(`http://${ADDRESS}:${PORT}/join/${gameIDToJoin},${nickname}`)
    .then(resp => {
        
        if (resp.status == 200) {
            gameState = resp.data;
            gameID = resp.data.gameID;
            isHost = false;
            updateUI();

            swal({
                title: `Joined ${gameState.nicknameHost}'s game! 😁`,
                icon: 'success',
                text: ' ',
                button: false,
                timer: 1500
              });

              setTimeout(function() {
                $('#choices-display').fadeIn();
                $('#game-buttons').fadeIn();
                document.querySelector("#choices-display").classList.remove("d-none");
                document.querySelector("#choices-display").classList.add("d-flex");
                document.querySelector("#game-buttons").classList.remove("d-none");
                document.querySelector("#game-buttons").classList.add("d-flex");
                get_game_state()
            }, 1500);

        } else {
            console.log("An error ocurred.");
        }
        
    }).catch(function(error) {
        if (error.response.status == 403) {
            swal({
                title: "The game is full!",
                icon: "error",
                text: "There's no room for you... 😶",
                buttons: false,
                timer: 2500
            });
        } else if (error.response.status == 404) {
            swal({
                title: "The game does not exist!",
                icon: "error",
                text: "Is the game ID correct? 🤔",
                buttons: false,
                timer: 2000
            });
        } else {
            console.log(error);
            swal({
                title: "An error ocurred.",
                icon: "error",
                text: "Check the browser console for more information. 🤓",
                buttons: false,
                timer: 2500
            });
        }
    });
};

// When the player clicks one of the options.
let choice_buttons_handler = (e) => {

    if (gameID == -1) {
        updateUI();
        return;
    }

    const choice = e.target.value;
    const request = `http://${ADDRESS}:${PORT}/choice/${gameID},${isHost},${choice}`;
    
    axios
    .post(request)
    .then(resp => {
        if (resp.status == 200) {
            gameState = resp.data;
            updateUI();
        } else {
            console.log("An error ocurred: ");
            console.log(resp);
        }
    }).catch(function(error) {
        console.log("An error ocurred: ");
        console.log(error);
    });   
}

// Get the current game state.
let get_game_state = () => {
    
    if (gameID == -1) {
        console.log("You are not currently in a game.");
        updateUI();
        return;
    }
    
    axios
    .get(`http://${ADDRESS}:${PORT}/getState/${gameID}`)
    .then(resp => {
        if (resp.status == 200) {
            gameState = resp.data;
            console.log("Received game state...");

            if (gameState.hostChoice == null || gameState.guestChoice == null) {
                ended = false;
            }

            updateUI();
   
            setTimeout(function() {
                get_game_state()
            }, 1000);
            return true;

        } else {
            console.log("An error ocurred: ");
            console.log(resp);
            return false;
        }
    }).catch(function(error) {
        console.log(error);
        swal({
            title: "Lost connection! 😢",
            icon: "error",
            buttons: {
                "ok": {
                    text: "OK",
                    value: "ok",
                    className: "btn btn-primary"
                }
            }
        }).then((value) => {
            switch(value) {
                case "ok":
                    location.reload();
                    break;
                default:
                    break;
            }
        });
        return false;
    });
    
};

// Send the server an update regarding the current player.
// Possible values: "ready" and "exit"
let update_player_status = (status) => {

    if (gameID == -1) {
        console.log("You are not currently in a game.");
        return;
    }

    if (status != "ready" && status != "exit") {
        console.log(`Invalid status ('${status}').`);
        return;
    }
    
    axios
    .post(`http://${ADDRESS}:${PORT}/playerStatus/${gameID},${isHost},${status}`)
    .then(resp => {
        if (resp.status == 200) {

            if (status == "ready") {
                gameState = resp.data;
                console.log("You're ready for next round! Received game state...");
            } else if (status == "exit") {
                gameID = -1;
                gameState = null;
                location.reload();
            }
            updateUI();

        } else {
            console.log("An error ocurred: ");
            console.log(resp);
            return false;
        }
    }).catch(function(error) {
        console.log(error);
        console.log("Lost connection! :(");
        gameID = -1;
        gameState = null;
        updateUI();
        return false;
    });

};

// Update the UI elements with the data of the current game state.
let updateUI = () => {

    // Make sure the player is connected to a game...
    if (gameID == -1) {
        document.querySelector("#your-choice").setAttribute("src", "./img/question.png");
        document.querySelector("#opponent-choice").setAttribute("src", "./img/question.png");
        document.querySelector("#nav-game-id").innerHTML = "&nbsp;-&nbsp;";
        document.querySelector("#host-name").innerHTML = "&nbsp;-&nbsp;";
        document.querySelector("#guest-name").innerHTML = "&nbsp;-&nbsp;";
        document.querySelector("#game-container").classList.add("d-none");
        document.querySelector("#forms-area").classList.remove("d-none");
        return;
    }
    
    $("#forms-area").fadeOut();
    document.querySelector("#forms-area").classList.add("d-none");
    $("#game-container").fadeIn();
    document.querySelector("#game-container").classList.remove("d-none");

    const hostChoice = (gameState.hostChoice == null) ? "question" : gameState.hostChoice;
    const guestChoice = (gameState.guestChoice == null) ? "question" : gameState.guestChoice;
    
    if (isHost) {

        document.querySelector("#you-host").classList.remove("d-none");
        document.querySelector("#you-guest").classList.add("d-none");

        // Hide buttons.
        if (hostChoice != "question") {
        }
        
        // Show choice.
        document.querySelector("#your-choice").setAttribute("src", `./img/${hostChoice}.png`)
        if (!ended) {
            document.querySelector("#opponent-choice").setAttribute("src", (guestChoice == "question") ? "./img/question.png" : "./img/ready.png");
        }

        // A guest joined the game.
        if (!opponentJoined && gameState.nicknameGuest != null) {

            opponentJoined = true;
            guestName = gameState.nicknameGuest;

            swal({
                title: `${gameState.nicknameGuest} joined the game! 🥳`,
                icon: 'success',
                text: ' ',
                button: false,
                timer: 1500
            });

            setTimeout(function() {
                $('#lonely').fadeOut();
                document.querySelector("#lonely").classList.add("d-none");
                document.querySelector("#lonely").classList.remove("d-flex");

                $('#choices-display').fadeIn();
                $('#game-buttons').fadeIn();
                document.querySelector("#choices-display").classList.remove("d-none");
                document.querySelector("#choices-display").classList.add("d-flex");
                document.querySelector("#game-buttons").classList.remove("d-none");
                document.querySelector("#game-buttons").classList.add("d-flex");
            }, 1500);

        // The guest left the game.
        } else if (opponentJoined && gameState.nicknameGuest == null) {

            opponentJoined = false;

            swal({
                title: `${guestName} left the game! 👋`,
                icon: 'error',
                text: ' ',
                button: false,
                timer: 1500
            });

            guestName = "";

            setTimeout(function() {
                $('#choices-display').fadeOut();
                $('#game-buttons').fadeOut();
                document.querySelector("#choices-display").classList.add("d-none");
                document.querySelector("#choices-display").classList.remove("d-flex");
                document.querySelector("#game-buttons").classList.add("d-none");
                document.querySelector("#game-buttons").classList.remove("d-flex");

                $('#lonely').fadeIn();
                document.querySelector("#lonely").classList.add("d-flex");
                document.querySelector("#lonely").classList.remove("d-none");
            }, 1500);
        }

    } else {
        
        document.querySelector("#you-host").classList.add("d-none");
        document.querySelector("#you-guest").classList.remove("d-none");

        // Hide buttons.
        if (guestChoice != "question") {
        }
        
        // Show choice.
        document.querySelector("#your-choice").setAttribute("src", `./img/${guestChoice}.png`)
        if (!ended) {
            document.querySelector("#opponent-choice").setAttribute("src", (hostChoice == "question") ? "./img/question.png" : "./img/ready.png");
        }
    }
    
    // The game info.
    document.querySelector("#nav-game-id").innerHTML = gameState.gameID;
    document.querySelector("#host-name").innerHTML = gameState.nicknameHost;
    document.querySelector("#guest-name").innerHTML = gameState.nicknameGuest == null ? "&nbsp;-&nbsp;" : gameState.nicknameGuest;
    
    // If waiting to restart...
    if (waitingToRestart) {
        // The game restarted, so close the alert.
        if (gameState.hostChoice == null && gameState.guestChoice == null) {
            swal.close();
            waitingToRestart = false;
        } else {
            if (!swal.getState().isOpen) {
                swal({
                    title: `Waiting for ${isHost ? gameState.nicknameGuest : gameState.nicknameHost}...`,
                    icon: "./img/waiting.gif",
                    buttons: {
                        leave: {
                            text: "Leave",
                            value: "leave",
                            className: "btn btn-danger"
                        }
                    }
                }).then((value) => {
                    switch(value) {
                        case "leave":
                            update_player_status("exit");
                            break;
                        default:
                            break;
                    }
                });
            }
        }
    }

    // If both players chose already, show the result.
    if (hostChoice != "question" && guestChoice != "question") {
        
        if (!ended) {
            ended = true;
        } else {
            return;
        }
        document.querySelector("#opponent-choice").setAttribute("src", `./img/${isHost ? guestChoice : hostChoice}.png`);

        let playerResult = "";

        // Determine result (if not a tie).
        if (hostChoice == guestChoice) {
            playerResult = "It's a tie!";
        } else if (isHost) {
            playerResult = `You ${outcomes[hostChoice][guestChoice] ? "win" : "lose"}!`;
        } else {
            playerResult = `You ${outcomes[guestChoice][hostChoice] ? "win" : "lose"}!`;
        }
        console.log(playerResult);

        // Sweet Alert with the result.
        swal({
            title: playerResult,
            icon: playerResult == "It's a tie!" ? "./img/equal.png" : (playerResult == "You win!" ? "./img/crown.png" : "./img/letter-l.png"),
            content: "<img src='./img/ready.png'>",
            buttons: {
                leave: {
                    text: "Leave",
                    value: null,
                    className: "btn btn-danger"
                },
                playAgain: {
                    text: "Play again",
                    value: "playAgain",
                    className: "btn btn-primary"
                }
            }
        }).then((value) => {
            switch(value) {
                case "playAgain":
                    update_player_status("ready");
                    waitingToRestart = true;
                    break;
                case null:
                    update_player_status("exit");
                    location.reload();
                    break;
                default:
                    update_player_status("ready");
            }
        });
    }

}

// DOMContentLoaded wait until all dom is loaded, check the docs in below link
// https://developer.mozilla.org/en-US/docs/Web/API/Document/DOMContentLoaded_event
document.addEventListener("DOMContentLoaded", (_) => {
    
    const createNicknameField = document.querySelector("#create-nickname");
    const joinNicknameField = document.querySelector("#join-nickname");

    // The buttons' behavior.
    document.querySelector('#create-btn').addEventListener('click', (event) => { create_game_handler() });
    document.querySelector('#join-btn').addEventListener('click', (event) => { join_game_handler() });
    
    // Make the enter key press the buttons when typing in the fields.
    document.querySelector("#create-nickname").addEventListener("keypress", (event) => {
        if (event.keyCode === 13) {
            document.querySelector("#create-btn").click();
        }
    });
    
    document.querySelector("#join-id").addEventListener("keypress", (event) => {
        if (event.keyCode === 13) {
            document.querySelector("#join-btn").click();
        }
    });

    // Remove the 'invalid' style when the user types something.
    document.querySelector("#create-nickname").addEventListener('input', (event) => {
        event.target.classList.remove("is-invalid");
        createNicknameField.setAttribute("placeholder", "");
    });
    
    document.querySelector("#join-nickname").addEventListener('input', (event) => {
        event.target.classList.remove("is-invalid");
        joinNicknameField.setAttribute("placeholder", "");
    });

    document.querySelector("#join-id").addEventListener('input', (event) => {
        // Regex to remove all non-digit characters.
        let value = event.target.value.trim().replace(/[^0-9]/g, '');
        // Keep only four characters.
        event.target.value = value.substring(0, 4);
        // Remove 'invalid' style.
        event.target.classList.remove("is-invalid");
    });

    document.querySelectorAll(".leave-btn").forEach(element => {
        element.addEventListener('click', (event) => {
            update_player_status("exit");
        });
    });
    
    document.querySelectorAll(".choice-btn").forEach(element => {
        element.addEventListener('click', (event) => { choice_buttons_handler(event) });
    });

    document.getElementById("create-nickname").focus();
    document.getElementById("create-nickname").select();

});