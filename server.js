require("dotenv").config();
const express=require("express"), mysql=require("mysql2/promise"), bcrypt=require("bcryptjs"), jwt=require("jsonwebtoken"), path=require("path");
const app = express();

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
const db=mysql.createPool({host:process.env.DB_HOST||"localhost",port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER||"root",password:process.env.DB_PASSWORD||"",database:process.env.DB_NAME||"bloodconnect",connectionLimit:10});
const SECRET=process.env.JWT_SECRET||"change_this_secret";
function auth(req,res,next){const t=(req.headers.authorization||"").replace(/^Bearer /,"");try{if(!t)throw 0;req.user=jwt.verify(t,SECRET);next();}catch{return res.status(401).json({error:"Please log in first."});}}
async function notify(userId,title,body){await db.execute("INSERT INTO notifications(user_id,title,body) VALUES(?,?,?)",[userId,title,body]);}

app.post("/api/register",async(req,res)=>{try{const {name,email,password,blood_group,phone,city,is_donor,college_id}=req.body;
if(!name||!email||!password||!blood_group)return res.status(400).json({error:"Name, email, password and blood group are required."});
if(password.length<6)return res.status(400).json({error:"Password must contain at least 6 characters."});
const hash=await bcrypt.hash(password,10);
const [r]=await db.execute("INSERT INTO users(name,email,password_hash,blood_group,phone,city,is_donor,college_id) VALUES(?,?,?,?,?,?,?,?)",[name.trim(),email.trim().toLowerCase(),hash,blood_group,phone||"",city||"",is_donor===false?0:1,college_id||""]);
res.status(201).json({message:"Account created successfully.",id:r.insertId});
}catch(e){console.error(e);res.status(e.code==="ER_DUP_ENTRY"?409:500).json({error:e.code==="ER_DUP_ENTRY"?"Email already registered.":"Registration failed. Check database setup."});}});
app.post("/api/login",async(req,res)=>{try{const [a]=await db.execute("SELECT * FROM users WHERE email=?",[(req.body.email||"").trim().toLowerCase()]);
if(!a.length||!await bcrypt.compare(req.body.password||"",a[0].password_hash))return res.status(401).json({error:"Incorrect email or password."});
const u=a[0],token=jwt.sign({id:u.id,name:u.name,email:u.email},SECRET,{expiresIn:"8h"});
res.json({token,user:{id:u.id,name:u.name,email:u.email,blood_group:u.blood_group,city:u.city}});
}catch(e){console.error(e);res.status(500).json({error:"Login failed."});}});
app.get("/api/me",auth,async(req,res)=>{const [r]=await db.execute("SELECT id,name,email,blood_group,phone,city,is_donor,college_id FROM users WHERE id=?",[req.user.id]);if(!r.length)return res.status(404).json({error:"User not found"});res.json(r[0]);});
app.patch("/api/me",auth,async(req,res)=>{const {name,phone,city,college_id,is_donor}=req.body;await db.execute("UPDATE users SET name=?,phone=?,city=?,college_id=?,is_donor=? WHERE id=?",[name||"",phone||"",city||"",college_id||"",is_donor?1:0,req.user.id]);res.json({message:"Profile updated."});});
app.get("/api/donors",auth,async(req,res)=>{const [r]=await db.execute("SELECT id,name,blood_group,phone,city FROM users WHERE is_donor=1 AND blood_group=? AND id<>? AND (?='' OR LOWER(city)=LOWER(?))",[req.query.blood_group,req.user.id,req.query.city||"",req.query.city||""]);res.json(r);});
app.post("/api/requests",auth,async(req,res)=>{try{const {patient_name,blood_group,units,hospital,city,needed_date,message,emergency}=req.body;
if(!patient_name||!blood_group||!hospital||!city)return res.status(400).json({error:"Patient, blood group, hospital and city are required."});
const [r]=await db.execute("INSERT INTO blood_requests(user_id,patient_name,blood_group,units,hospital,city,needed_date,message,emergency) VALUES(?,?,?,?,?,?,?,?,?)",[req.user.id,patient_name,blood_group,Math.max(1,Number(units)||1),hospital,city,needed_date||null,message||"",emergency?1:0]);
if(emergency){const [donors]=await db.execute("SELECT id FROM users WHERE is_donor=1 AND blood_group=? AND id<>?",[blood_group,req.user.id]);for(const d of donors)await notify(d.id,"Emergency Blood Request",`An emergency ${blood_group} request was created in ${city}.`);}
res.status(201).json({message:"Blood request created.",id:r.insertId});
}catch(e){console.error(e);res.status(500).json({error:"Could not create request. Run migration.sql first if a column is missing."});}});
app.get("/api/requests",auth,async(req,res)=>{const mine=req.query.mine==="true";const sql="SELECT b.*,u.name requester_name FROM blood_requests b JOIN users u ON u.id=b.user_id "+(mine?"WHERE b.user_id=? ":"")+"ORDER BY b.created_at DESC";const [r]=await db.execute(sql,mine?[req.user.id]:[]);res.json(r);});
app.post("/api/requests/:id/respond",auth,async(req,res)=>{try{const [q]=await db.execute("SELECT user_id,blood_group FROM blood_requests WHERE id=?",[req.params.id]);if(!q.length)return res.status(404).json({error:"Request not found."});if(q[0].user_id===req.user.id)return res.status(400).json({error:"You cannot respond to your own request."});
await db.execute("INSERT INTO donor_responses(request_id,donor_id,message) VALUES(?,?,?)",[req.params.id,req.user.id,req.body.message||"I am interested in donating."]);
await notify(q[0].user_id,"Donor Response","A donor has responded to your blood request.");res.status(201).json({message:"Your response was sent."});
}catch(e){res.status(e.code==="ER_DUP_ENTRY"?409:500).json({error:e.code==="ER_DUP_ENTRY"?"You already responded.":"Could not send response."});}});
app.get("/api/my-responses",auth,async(req,res)=>{const [r]=await db.execute("SELECT d.id,d.message,d.status,d.created_at,b.patient_name,b.blood_group,b.hospital,b.city,u.name donor_name,u.phone FROM donor_responses d JOIN blood_requests b ON b.id=d.request_id JOIN users u ON u.id=d.donor_id WHERE b.user_id=? ORDER BY d.created_at DESC",[req.user.id]);res.json(r);});
app.get("/api/requests/:id/responses",auth,async(req,res)=>{const [own]=await db.execute("SELECT id FROM blood_requests WHERE id=? AND user_id=?",[req.params.id,req.user.id]);if(!own.length)return res.status(404).json({error:"Request not found."});const [r]=await db.execute("SELECT d.message,d.status,u.name,u.email,u.phone,u.blood_group,u.city FROM donor_responses d JOIN users u ON u.id=d.donor_id WHERE d.request_id=?",[req.params.id]);res.json(r);});
app.patch("/api/requests/:id/status",auth,async(req,res)=>{const allowed=["Open","Donor Found","Completed","Cancelled"];if(!allowed.includes(req.body.status))return res.status(400).json({error:"Invalid status."});const [r]=await db.execute("UPDATE blood_requests SET status=? WHERE id=? AND user_id=?",[req.body.status,req.params.id,req.user.id]);if(!r.affectedRows)return res.status(404).json({error:"Request not found."});res.json({message:"Status updated."});});
app.get("/api/donations",auth,async(req,res)=>{const [r]=await db.execute("SELECT id,hospital,city,donation_date FROM donation_records WHERE user_id=? ORDER BY donation_date DESC",[req.user.id]);res.json(r);});
app.post("/api/donations",auth,async(req,res)=>{const {hospital,city,donation_date}=req.body;if(!hospital||!city||!donation_date)return res.status(400).json({error:"Hospital, city and donation date are required."});await db.execute("INSERT INTO donation_records(user_id,hospital,city,donation_date) VALUES(?,?,?,?)",[req.user.id,hospital,city,donation_date]);res.json({message:"Donation record saved."});});
app.get("/api/notifications",auth,async(req,res)=>{const [r]=await db.execute("SELECT id,title,body,created_at,is_read FROM notifications WHERE user_id=? ORDER BY created_at DESC",[req.user.id]);res.json(r);});
app.patch("/api/notifications/:id/read",auth,async(req,res)=>{await db.execute("UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?",[req.params.id,req.user.id]);res.json({message:"Notification marked as read."});});
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", app: "BloodConnect" });
});

const port = process.env.PORT || 3000;

(async () => {
  try {
    await db.query("SELECT 1");

    app.listen(port, "0.0.0.0", () => {
      console.log(`BloodConnect running on port ${port}`);
    });
  } catch (e) {
    console.error("MySQL connection failed:", e.message);
    process.exit(1);
  }
})();