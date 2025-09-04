const yubi = require("yub");
yubi.init(process.env.YUBI_ID, process.env.YUBI_SECRET);
function verifyYubiKey(otp) {
  return new Promise((resolve, reject) => {
    yubi.verify(otp, (err, data) => {
      if (err) {
        return reject(err);
      }
      if (data) {
        if (data.status === "REPLAYED_OTP") {
          reject(new Error("Replayed OTP"));
        } else {
          if (data.status == "OK") {
            resolve(data);
          } else {
            const e = new Error("Invalid OTP: " + data.status);
            e.data = data;
            reject(e);
          }
        }
      }
    });
  });
}

module.exports = {
  verifyYubiKey,
};
