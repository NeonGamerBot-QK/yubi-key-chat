require("dotenv").config();
const yubi = require("yub");

yubi.init(process.env.YUBI_ID, process.env.YUBI_SECRET);

yubi.verify("cccccbceufvlunbgnbhgccnbdfjidtbbetjrgfnetfif", (e, d) => {
  console.log(e, d);
});
