require("dotenv/config");

const express = require("express");
const { verifyYubiKey } = require("./utils");
const Prisma = require("@prisma/client").PrismaClient;
var cookieParser = require("cookie-parser");
const socketIo = require("socket.io");
const http = require("http");
const prisma = new Prisma();
const app = express();
const port = 3000;
const server = http.createServer(app);
const io = socketIo(server);
app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(async (req, res, next) => {
  if (req.cookies.serial && !req.cookies.identity) {
    res.clearCookie("serial");
    return res.redirect("/login");
  }
  if (req.cookies.identity) {
    const user_info = await prisma.user.findFirst({
      where: {
        serial: req.cookies.serial,
        identityString: req.cookies.identity,
      },
    });
    if (!user_info) {
      res.clearCookie("serial");
      res.clearCookie("identity");
      return res.redirect("/login");
    }
  }
  next();
});
app.get("/", (req, res) => {
  if (!req.cookies.serial) {
    return res.redirect("/login");
  } else {
    return res.redirect("/chat");
  }
});

app.get("/chat", (req, res) => {
  if (!req.cookies.serial) {
    return res.redirect("/login");
  }
  // res.send('chat')
  res.render("layout", {
    title: "Chat",
    file: "index.ejs",
    username: req.cookies.serial,
  });
});

app.get("/login", (req, res) => {
  if (req.cookies.serial) {
    return res.redirect("/chat");
  }
  res.render("layout", { title: "Login", file: "login.ejs" });
});

app.post("/login", async (req, res) => {
  // validate key
  const otp = req.body.otp;
  console.log(otp);
  try {
    const yubData = await verifyYubiKey(otp);
    // console.log(yubData);
    if (!yubData.valid) {
      return res.status(400).json({ message: "Invalid OTP" });
    }
    yubData.serial = yubData.serial.toString();
    const userData = await prisma.user.findFirst({
      where: {
        serial: yubData.serial,
      },
    });
    if (!userData) {
      console.log("user not found");
      // erm, time to create there data!
      // res.status(404).json({ message: 'User not found' })
      await prisma.user.create({
        data: {
          serial: yubData.serial,
          lastOtp: yubData.otp,
          yubiKeyOtps: [yubData],
          identityString: yubData.identity,
          // add other fields as necessary
        },
      });
      // set cookies to be like the login serial idk
      // req.cookies.serial = yubData.serial;
      res.cookie("serial", yubData.serial, { maxAge: 900000, httpOnly: true });
      res.cookie("identity", yubData.identity, {
        maxAge: 900000,
        httpOnly: true,
      });
      // redirect to dashboard
      res.redirect("/chat");
    } else {
      // if account exists, up
      // update userEntry to update the lastOtp
      prisma.user.update({
        where: {
          serial: yubData.serial,
        },
        data: {
          lastOtp: yubData.otp,
          // push to array
          yubiKeyOtps: {
            push: yubData,
          },
        },
      });

      res.cookie("serial", yubData.serial, { maxAge: 900000, httpOnly: true });
      res.cookie("identity", yubData.identity, {
        maxAge: 900000,
        httpOnly: true,
      });
      // redirect to dashboard
      res.redirect("/chat");
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: e.message, error: true });
  }
});
const users = [];
const last_10_msgs = [];
io.on("connection", (socket) => {
  console.log("a user connected");
  users.push(socket.id);
  socket.on("disconnect", () => {
    console.log("user disconnected");
    const index = users.indexOf(socket.id);
    if (index > -1) {
      users.splice(index, 1);
    }
  });
  socket.on("chat message", (msg, author) => {
    io.emit("chat message", msg, author);
    // add to last 10 msgs
    last_10_msgs.push({ msg, author });
    if (last_10_msgs.length > 10) {
      last_10_msgs.shift();
    }
  });
});
// verifyYubiKey
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
