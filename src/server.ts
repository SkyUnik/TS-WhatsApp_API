import express from "express";

const server = express();

server.all("/", (req, res) => {
    // res.setHeader("Content-Type", "text/html");

    res.send("Hosting Is Active!");

    // res.end();
});

export default function keepAlive(port: number) {
    function startServer() {
        server
            .listen(port, () => {
                console.log("Server listening on Port", port);
            })
            .on("error", (err: NodeJS.ErrnoException) => {
                console.log(`Error in server setup: ${err}`);
                setTimeout(startServer, 5000);
            });
    }
    startServer();
}
