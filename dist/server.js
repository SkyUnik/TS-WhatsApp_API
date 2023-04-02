"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const server = (0, express_1.default)();
const port = 3000;
server.all("/", (req, res) => {
    // res.setHeader("Content-Type", "text/html");
    res.send("Hosting Is Active!");
    // res.end();
});
function keepAlive() {
    server.listen(port, () => {
        console.log("Server is online!");
    });
}
exports.default = keepAlive;
