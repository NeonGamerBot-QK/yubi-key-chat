require("dotenv/config");

const express = require("express");
const { verifyYubiKey } = require("./utils");
const Prisma = require("@prisma/client").PrismaClient;
const prisma = new Prisma();
const app = express();
const port = 3000;
app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(express.json());
app.get("/", (req, res) => {
  // res.send("change to rendered");
  // res.render('index');
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
});

app.get("/login", (req, res) => {
  if (req.cookies.serial) {
    return res.redirect("/chat");
  }
  res.render("index");
});

app.post("/login", async (req, res) => {
  // validate key
  const otp = req.body.otp;
  console.log(otp);
  try {
    const yubData = await verifyYubiKey(otp);
    console.log(yubData);
    if (!yubData.valid) {
      return res.status(400).json({ message: "Invalid OTP" });
    }
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
          // add other fields as necessary
        },
      });
      // set cookies to be like the login serial idk
      res.cookies.serial = yubData.serial;
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

      res.cookies.serial = yubData.serial;
      // redirect to dashboard
      res.redirect("/chat");
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: e.message });
  }
});

// verifyYubiKey
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
