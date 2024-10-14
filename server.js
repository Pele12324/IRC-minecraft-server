const WebSocket = require("ws");

// Create a WebSocket server on port 6667

var port = 80;

const wss = new WebSocket.Server({ port: port });

// Store connected users with username as key
const users = new Map(); // Maps userId to { username, ws }

// Broadcast a message to all connected clients
function broadcast(data) {
    const message = typeof data === "string" ? data : JSON.stringify(data);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// Handle incoming connections
wss.on("connection", (ws) => {
    let userId;
    let username;

    ws.on("message", (message) => {
        // Check if message is a buffer and convert it to a string
        if (Buffer.isBuffer(message)) {
            message = message.toString();
        }

        try {
            const json = JSON.parse(message);
            console.log("Parsed message:", json);

            switch (json.method) {
                case "login":
                    userId = json.key; // Use the provided key as the user ID
                    username = json.username; // Get the username from the login

                    // Check if the username is already taken
                    const existingUser = Array.from(users.values()).find(
                        (user) => user.username === username,
                    );
                    if (existingUser) {
                        // Send error message to the client
                        ws.send(
                            JSON.stringify({
                                success: false,
                                error: "Username is already taken.",
                            }),
                        );
                        ws.close(); // Optionally close the connection
                        return; // Exit the function early
                    }

                    // If username is unique, proceed to log in
                    users.set(userId, { username, ws });
                    ws.send(JSON.stringify({ success: true }));
                    ws.send(
                        JSON.stringify({
                            method: "online",
                            users: Array.from(users.values()).map(
                                (user) => user.username,
                            ),
                        }),
                    );
                    break;

                case "message":
                    console.log(
                        `Received message from ${username}: ${json.message}`,
                    );

                    // Prepare the response object
                    const response = {
                        method: "message",
                        username,
                        message: json.message,
                        recipients: json.recipients,
                    };

                    // Broadcast to everyone
                    if (json.recipients.includes("everyone")) {
                        console.log(
                            `Broadcasting message from ${username} to everyone: ${json.message}`,
                        );
                        broadcast(JSON.stringify(response));
                    } else {
                        // Send to specific recipients
                        json.recipients.forEach((recipient) => {
                            // Log recipient being searched for
                            console.log("Looking for recipient:", recipient);

                            // Normalize the recipient to lowercase
                            const normalizedRecipient = recipient.toLowerCase();

                            // Find recipient without changing case
                            const recipientData = Array.from(
                                users.values(),
                            ).find(
                                (user) =>
                                    user.username.toLowerCase() ===
                                    normalizedRecipient,
                            );

                            if (recipientData) {
                                console.log(
                                    `Sending message from ${username} to ${recipient}: ${json.message}`,
                                );
                                recipientData.ws.send(JSON.stringify(response)); // Send to specific user
                            } else {
                                console.error(`User ${recipient} not found.`);
                                ws.send(
                                    JSON.stringify({
                                        success: false,
                                        error: `Username ${recipient} is not valid/online.`,
                                    }),
                                );
                            }
                        });
                    }
                    break;

                case "heartbeat":
                    console.log(`Heartbeat received from ${username}`);
                    break;

                case "online":
                    ws.send(
                        JSON.stringify({
                            method: "online",
                            users: Array.from(users.values()).map(
                                (user) => user.username,
                            ),
                        }),
                    );
                    break;

                default:
                    console.error("Unknown method:", json.method);
            }
        } catch (error) {
            console.error("Error processing message:", error);
        }
    });

    // Handle disconnection
    ws.on("close", () => {
        if (username) {
            users.delete(userId);
            console.log(`User ${username} has disconnected.`);
        }
    });
});

// Log when the server is running
console.log(`IRC WebSocket server running on ws://localhost:${port}`);
