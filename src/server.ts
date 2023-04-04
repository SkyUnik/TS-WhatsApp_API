import express from "express";

const server = express();
const port = 3000;

server.all("/", (req, res) => {
    // res.setHeader("Content-Type", "text/html");

    res.send("Hosting Is Active!");

    // res.end();
});

export default function keepAlive() {
    server.listen(port, () => {
        console.log("Server is online!");
    });
}
