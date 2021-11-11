require('dotenv').config()
const express = require("express");
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const session = require("express-session");
const passportLocalMongoose = require("passport-local-mongoose");
const passport = require('passport');
const secure = require('express-force-https');
const Razorpay = require("razorpay");
const instance = new Razorpay({key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET});
const randomatic = require("randomatic");
const axios = require('axios');
const generateApiKey = require('generate-api-key');
const Jimp = require('jimp');
app.use(express.static("public"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.set("view engine","ejs")
app.use(secure);
app.use(session({secret: process.env.SESSION_SECRET,resave: true,saveUninitialized:true,cookie:{maxAge: 1000*60*60*24*30*3}}));
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(process.env.LOCAL_DB_URL,{useNewUrlParser:true,useUnifiedTopology:true}).catch((err)=>{console.log(err);});
mongoose.set("useCreateIndex",true);

const adminOptionsSchema = mongoose.Schema({
    type: String,
    withdrawEnabled: Boolean,
    kycEnabled: Boolean,
    transferEnabled: Boolean,
    walletHistoryEnabled: Boolean
});

const usersSchema = mongoose.Schema({
    username: String,
    name:String,
    email:String,
    password:String,
    isAdmin:Boolean,
    isBlocked:Boolean,
    addresses: Array,
    testApiKey: String,
    liveApiKey: String,
    newMessages: Boolean,
    unreadMessages: Boolean,
    approvedMerchant: String
}); 

const ordersSchema = mongoose.Schema({
    orderNo: String,
    item: String,
    price: Number,
    date: String,
    username: String,
    thumbnail: String,
    address: Object,
    size: String,
    color: String
});

const walletHistorySchema = mongoose.Schema({
    transactionID: String,
    amount: Number,
    date: String,
    time: String,
    username: String,
    transferredFrom: String,
    transferredTo: String,
    spentOnOrder: Boolean,
    pending: Boolean,
    payoutID: String,
    collectedFromMerchant: String,
    payoutToMerchant: String,
    payoutFromMerchant: String
});

const ProductsSchema = mongoose.Schema({
    name:String,
    price:Number,
    images:Array,
    description:String,
    sizes: Array,
    colors: Array
});

const balanceSchema = mongoose.Schema({
    username:String,
    balance: Number,
    testBalance: Number,
    walletID: Number,
    qrImage: String,
    qrID: String
});

const kycSchema = mongoose.Schema({
    username:String,
    name:String,
    aadhar_no:String,
    pan_no:String,
    bank_name:String,
    ac_holder_name:String,
    account_username:String,
    ifsc_code:String,
    aadhar_1:String,
    aadhar_2:String,
    bank_passbook_or_cancelled_check:String,
    your_selfie:String,
    status:String,
    date:String
});

const resetPasswordSchema = mongoose.Schema({
    username: String,
    otp: String,
    expire_at: {type: Date, default: Date.now, expires: 60*60} 
});

const signupOTPSchema = mongoose.Schema({
    username: String,
    otp: String,
    expire_at: {type: Date, default: Date.now, expires: 60*60} 
});

const APIPaymentSchema = mongoose.Schema({
    paymentID: String,
    username: String,
    amount: Number,
    apiKey: String,
    otp: String,
    expire_at: {type: Date, default: Date.now, expires: 60*5} 
});

const merchantTransactionsSchema = mongoose.Schema({
    transactionID: String,
    username: String,
    amount: Number,
    merchantUsername: String,
    date: String,
    time: String 
});

const chatsSchema = mongoose.Schema({
    username: String,
    message: String,
    fromAdmin: Boolean, 
});

usersSchema.plugin(passportLocalMongoose);

const User = mongoose.model("user",usersSchema);
const Balance = mongoose.model("balance",balanceSchema);
const KYC = mongoose.model("kyc",kycSchema);
const Order = mongoose.model("order",ordersSchema);
const Product = mongoose.model("product",ProductsSchema);
const WalletHistory = mongoose.model("wallet history",walletHistorySchema);
const AdminOption = mongoose.model("admin option",adminOptionsSchema);
const ResetPassword = mongoose.model("reset password",resetPasswordSchema);
const SignupOTP = mongoose.model("signup OTP",signupOTPSchema);
const APIPayment = mongoose.model("API payment",APIPaymentSchema);
const MerchantTransaction = mongoose.model("merchant transaction",merchantTransactionsSchema);
const Chat = mongoose.model("chat",chatsSchema);

passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// >>>>>>>>>>>>>>>>>>>>>>>>>ROUTES<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

// AUTH ROUTES
app.get("/login",(req,res)=>{
    res.render("auth/login",{loginFailed: false});
});

app.get("/loginERR",(req,res)=>{
    res.render("auth/login",{loginFailed: true});
});

app.post("/login",(req,res)=>{
    var redirectTo = req.session.current_url ? req.session.current_url : "/";

    var user = new User({
        username:req.body.username,
        password:req.body.password
    });
    req.login(user,function(err){
        passport.authenticate("local",{failureRedirect:"/loginERR"})(req,res,function(){
            res.redirect(redirectTo);
        });
    });
});

//signup route
app.get("/signup",(req,res)=>{
    res.render("auth/signup",{err:false,host: req.headers.host, protocol: req.protocol});
});

app.get("/get/otp/:number",async(req,res)=>{
    var userAlreadyExists = await User.findOne({username: req.params.number});

    if(userAlreadyExists){
        res.send('account already exists');
    }else{
        var otp = generateOTP();

        axios({
            url: "https://www.fast2sms.com/dev/bulkV2",
            method: "post",
            headers: {"authorization": process.env.FAST2SMS_AUTH},
            data: {
                "variables_values": otp,
                "route": "otp",
                "numbers": req.params.number,
            }
        }).then(async(ee)=>{
            if(ee.data.return){
                await SignupOTP.deleteOne({username: req.params.number});

                var signupOTP = new SignupOTP({
                    username: req.params.number,
                    otp: otp
                });
    
                signupOTP.save();
    
                res.send('OTP sent successfully');
            }else{
                res.send('error sending OTP');
            }
        }).catch((err)=>{
            res.send('error sending OTP');
        });

    }
});

app.post('/resend/otp/:number',async(req,res)=>{
    var otp = await SignupOTP.findOne({username: req.params.number});
    if(otp){
        axios({
            url: "https://www.fast2sms.com/dev/bulkV2",
            method: "post",
            headers: {"authorization": process.env.FAST2SMS_AUTH},
            data: {
                "variables_values": otp.otp,
                "route": "otp",
                "numbers": req.params.number,
            }
        }).then((ee)=>{
            if(ee.data.return){
                res.send("OTP resent successfully");
            }else{
                res.send("error resending OTP");
            }
        }).catch((err)=>{
            res.send("error resending OTP");
        });
    }else{
        res.send('otp expired. Please reload');
    }
});

app.get('/resetPassword',(req,res)=>{
    res.render('resetPassword');
});

app.post('/resetPassword',async(req,res)=>{
    var isOTPCorrect = await ResetPassword.findOneAndDelete({username: req.body.number, otp: req.body.otp});

    if(isOTPCorrect){
        User.findOneAndDelete({username: req.body.number},function (err, user) {
            if (err){
                console.error(err);
            }else{
                User.register({username: req.body.number,name: user.name, email: user.email,addresses: user.addresses},req.body.new_password,function(err,user){
                    res.send("<h1>password sucessfully changed</h1> <br> <h3><a href='/'>back to sign in screen</a></h3>");
                });
            }
        });
    }else{
        res.send("incorrect OTP");
    }
});

app.get("/reset/otp/:number",async(req,res)=>{
    var isUser = await User.findOne({username: req.params.number});
    
    if(isUser){
        var otp = generateOTP();

        axios({
            url: "https://www.fast2sms.com/dev/bulkV2",
            method: "post",
            headers: {"authorization": process.env.FAST2SMS_AUTH},
            data: {
                "variables_values": otp,
                "route": "otp",
                "numbers": req.params.number,
            }
        }).then(async(ee)=>{
            await ResetPassword.deleteOne({username: req.params.number});

            var resetOTP = new ResetPassword({
                username: req.params.number,
                otp: otp
            });
        
            resetOTP.save();

            res.send("OTP sent successfully");
            
        }).catch((err)=>{
            res.send("some error occured. Please contact support");
        });

    }else{
        res.send("account does not exist");
    }
});

function generateOTP() {
    var digits = '0123456789';
    let OTP = '';
    for (let i = 0; i < 6; i++ ) {
        OTP += digits[Math.floor(Math.random() * 10)];
    }
    return OTP;
}

function getformattedDate() {
    var currentTimestamp = new Date();
    var date = currentTimestamp.getDate().toString().padStart(2,'0')+"/"+(currentTimestamp.getMonth()+1).toString().padStart(2,'0')+"/"+currentTimestamp.getFullYear();
    return date;
}

function getformattedTime() {
    var currentTimestamp = new Date();
    var time = currentTimestamp.getHours().toString().padStart(2,'0')+":"+currentTimestamp.getMinutes().toString().padStart(2,'0');
    return time;
}

app.post("/signup",async(req,res)=>{
    var otpValid = await SignupOTP.findOneAndDelete({username: req.body.username, otp: req.body.otp});
    if(otpValid){

        instance.api.post({
            url:"/payments/qr_codes",
            data:{
                type: 'upi_qr',
                usage: 'multiple_use',
                fixed_amount: 0,
                description: req.body.name
            }
        },function(err1,res1){
            if(err1){
                console.log(err1);
            }else{

                User.register({username: req.body.username,name: req.body.name, email: req.body.email},req.body.password,async function(err,user){
                    if(err){
                        res.send(err.message);
                    }else{        
    
                        var walletID = Math.floor(Math.random() * 9000000000) + 1000000000;
                        var idAlreadyTaken = await Balance.findOne({walletID: walletID});
    
                        if(idAlreadyTaken){
                            res.send('some error occured, please try again');
                        }else{
                            var balance = new Balance({
                                username: req.body.username,
                                balance: 0,
                                walletID: walletID,
                                qrImage: res1.image_url,
                                qrID: res1.id
                            });
                
                            balance.save();
                
                            passport.authenticate("local")(req,res,function(err, result){
                                res.send("success");
                            });
                        }
    
                    }
                });
            }
        });

    }else{
        res.send('invalid otp');
    }
});

//>>>>>>>>>>>>>>>>>>> MAIN ROUTES <<<<<<<<<<<<<<<<<

// HOME ROUTE
app.get("/",async(req,res)=>{
    if(req.isAuthenticated()){
        if(req.user.isBlocked){
            res.render("blocked");
        }else{
            var products = await Product.find();
            var balance = await Balance.findOne({username: req.user.username});
            balance = balance.balance/100;
            res.render("main/home",{balance: balance,products:products});
        }
    }else{
        var products = await Product.find();
        res.render("main/home",{products:products});
    }
});

// PROFILE ROUTE
app.get("/profile",async(req,res)=>{
    if(req.isAuthenticated()){
        if(req.user.isBlocked){
            res.render("blocked");
        }else{
            var balance = await Balance.findOne({username: req.user.username});
            var walletID = balance.walletID;
            balance = balance.balance/100;

            if(req.user.isAdmin){
                var hasUnread = await User.findOne({newMessages: true});
            }else{
                var hasUnread = (await User.findOne({username: req.user.username})).unreadMessages;
            }


            var enabledOptions = await AdminOption.findOne({type: 'default options'});
            res.render("main/profile",{balance: balance,walletID: walletID, enabledOptions: enabledOptions, hasUnread: hasUnread, isAdmin: req.user.isAdmin});
        }
    }else{
        req.session.current_url = "/profile";
        res.redirect("/login")
    }
});

// ORDERS ROUTE
app.get("/orders",async(req,res)=>{
    if(req.isAuthenticated()){
        if(req.user.isBlocked){
            res.render("blocked");
        }else{
            var userOrders = await Order.find({username: req.user.username}); 
            res.render("main/orders",{orders: userOrders});
        }
    }else{
        req.session.current_url = "/orders";
        res.redirect("/login")
    }
});

app.get("/orders/:orderNo",async(req,res)=>{
    if(req.isAuthenticated()){
        if(req.user.isBlocked){
            res.render("blocked");
        }else{
            var order = await Order.findOne({orderNo: req.params.orderNo}); 
            if(order.username == req.user.username || req.user.isAdmin){
                if(order){
                    res.render("order",{order: order});
                }else{
                    res.send("invalid order id");
                }
            }else{
                res.sendStatus(403);
            }
        }
    }else{
        req.session.current_url = "/";
        res.redirect("/login")
    }
});


app.get("/walletHistory",async(req,res)=>{
    var isEnabled = (await AdminOption.findOne({type: 'default options'})).walletHistoryEnabled;
    if(isEnabled){
        if(req.isAuthenticated()){
            if(req.user.isBlocked){
                res.render("blocked");
            }else{
                var walletHisotry = await WalletHistory.find({username: req.user.username}); 
                res.render("walletHistory",{walletHisotry: walletHisotry});
            }
        }else{
            req.session.current_url = "/walletHistory";
            res.redirect("/login")
        }
    }else{
        res.send('service disabled');
    }
});

//MORE ROUTE
app.get("/more",async(req,res)=>{
    res.render("main/more");
});


// ADMIN FUNCTIONALITIES ROUTES
app.get('/admin/toggle-withdraw',async(req,res)=>{
    if(req.isAuthenticated() && req.user.isAdmin){
        var state = await AdminOption.findOne({type: "default options"});
        AdminOption.updateOne({type: 'default options'},{$set: {withdrawEnabled: !state.withdrawEnabled}},function(){
            res.redirect('/admin');
        });
    }else{
        req.session.current_url = "/admin";
        res.redirect('/login');
    }
});

app.get('/admin/toggle-kyc',async(req,res)=>{
    if(req.isAuthenticated() && req.user.isAdmin){
        var state = await AdminOption.findOne({type: 'default options'});
        AdminOption.updateOne({type: 'default options'},{$set: {kycEnabled: !state.kycEnabled}},function(){
            res.redirect('/admin');
        });
    }else{
        req.session.current_url = "/admin";
        res.redirect('/login');
    }
});

app.get('/admin/toggle-transfer',async(req,res)=>{
    if(req.isAuthenticated() && req.user.isAdmin){
        var state = await AdminOption.findOne({type: 'default options'});
        AdminOption.updateOne({type: 'default options'},{$set: {transferEnabled: !state.transferEnabled}},function(err){
            res.redirect('/admin');
        });
    }else{
        req.session.current_url = "/admin";
        res.redirect('/login');
    }
});

app.get('/admin/toggle-wallet-history',async(req,res)=>{
    if(req.isAuthenticated() && req.user.isAdmin){
        var state = await AdminOption.findOne({type: 'default options'});
        AdminOption.updateOne({type: 'default options'},{$set: {walletHistoryEnabled: !state.walletHistoryEnabled}},function(){
            res.redirect('/admin');
        });
    }else{
        req.session.current_url = "/admin";
        res.redirect('/login');
    }
});

app.get("/admin",async(req,res)=>{
    if(req.user && req.user.isBlocked){
        res.render("blocked");
    }else if(req.isAuthenticated() && req.user.isAdmin){
        var users = await User.find();
        var balances = await Balance.find();
        var usersWithBalances = [];
        users.forEach((user)=>{
            balances.forEach((balance)=>{
                if(user.username == balance.username){
                    usersWithBalances.push({
                        username: user.username,
                        balance: (balance.balance/100),
                        isAdmin: user.isAdmin,
                        isBlocked:user.isBlocked
                    });
                }
            })
        });

        var adminOptions = await AdminOption.findOne({type: 'default options'});
        res.render("admin/admin",{users:usersWithBalances,user:req.user.username,isAdmin: req.user.isAdmin,adminOptions:adminOptions});
    }else{
        req.session.current_url = "/admin";
        res.redirect("/login")
    }
});

app.post("/admin",(req,res)=>{
    if(req.isAuthenticated() && req.user.isAdmin){
        if(req.body.action == "block"){
            User.updateOne({username: req.body.username},{$set:{isBlocked:true}},function(){});
        }else if(req.body.action == "addadmin"){
            User.updateOne({username: req.body.username},{$set:{isAdmin:true}},function(){});
        }else if(req.body.action == "unblock"){
            User.updateOne({username: req.body.username},{$set:{isBlocked:false}},function(){});
        }
    }else{
        res.sendStatus(403);
    }
});

app.get("/adminKYCS",async(req,res)=>{
    if(req.isAuthenticated() && req.user.isAdmin){
        var kycForms = await KYC.find();
        res.render("admin/adminKYCS",{kycForms,isAdmin:req.user.isAdmin});
    }else{
        res.redirect("/");
    }
});

app.get("/adminKYCS/:username",async(req,res)=>{
    if(req.isAuthenticated() && req.user.isAdmin){
        var kycForm = await KYC.findOne({username: req.params.username});
        res.render("admin/adminKYC",{kycForm:kycForm,isAdmin:req.user.isAdmin});
    }else{
        res.redirect("/");
    }
});

app.get("/adminKYCS/:username/:action",async(req,res)=>{
    if(req.isAuthenticated() && req.user.isAdmin){
        KYC.updateOne({username: req.params.username},{$set:{status:req.params.action}},function(){});
        res.redirect("/adminKYCS");
    }else{
        res.redirect("/");
    }
});

app.get("/adminProducts",async(req,res)=>{
    if(req.isAuthenticated() && req.user.isAdmin){
        var products = await Product.find();
        res.render("admin/adminProducts",{isAdmin:req.user.isAdmin,products:products});
    }else{
        res.redirect("/");
    }
});

app.get("/adminProducts/add",(req,res)=>{
    if(req.isAuthenticated() && req.user.isAdmin){
        res.render("admin/addProduct",{isAdmin:req.user.isAdmin});
    }else{
        res.redirect("/");
    }
});

app.get("/adminProducts/:itemName",async(req,res)=>{
    if(req.isAuthenticated() && req.user.isAdmin){
        var product = await Product.findOne({name: req.params.itemName});
        res.render("admin/editProduct",{isAdmin:req.user.isAdmin,product:product});
    }else{
        res.redirect("/");
    }
});

app.post("/adminProducts/add",(req,res)=>{
    if(req.isAuthenticated() && req.user.isAdmin){
        var params = req.body;

        var images = [];

        if(params.image_1){images.push(params.image_1);}
        if(params.image_2){images.push(params.image_2);}
        if(params.image_3){images.push(params.image_3);}
        if(params.image_4){images.push(params.image_4);}
        if(params.image_5){images.push(params.image_5);}

        var colors = [];

        if(params.color_1){colors.push(params.color_1);}
        if(params.color_2){colors.push(params.color_2);}
        if(params.color_3){colors.push(params.color_3);}
        if(params.color_4){colors.push(params.color_4);}        
        if(params.color_5){colors.push(params.color_5);}

        var sizes = [];

        if(params.XS == "on"){sizes.push("XS");}
        if(params.S == "on"){sizes.push("S");}
        if(params.M == "on"){sizes.push("M");}
        if(params.L == "on"){sizes.push("L");}
        if(params.XL == "on"){sizes.push("XL");}


        const product = new Product({
            name: params.name,
            price: params.price,
            images: images,
            description: params.description,
            colors: colors,
            sizes: sizes
        });

        product.save();

        res.redirect("/adminProducts");
    }else{
        res.sendStatus(403);
    }
});

app.get("/adminOrders",async(req,res)=>{
    if(req.isAuthenticated() && req.user.isAdmin){
        var orders = await Order.find();
        res.render("admin/adminOrders",{orders:orders,isAdmin: req.user.isAdmin});
    }else{
        res.redirect("/");
    }
});

// DEPOSIT MONEY ROUTES
app.get('/qr',async(req,res)=>{
    if(req.user && req.user.isBlocked){
        res.render("blocked");
    }else if(req.isAuthenticated()){
        var qrImage = (await Balance.findOne({username: req.user.username})).qrImage;
        const image = await Jimp.read(qrImage);
        const base64 = await image.crop(110, 615, 450, 450).getBase64Async(Jimp.MIME_JPEG);
        res.render("qr",{qr_image: base64});
    }else{
        res.redirect("/");
    }
});

app.post('/qr/webhooks',async(req,res)=>{
    if(req.body.payload.qr_code.entity.id && req.body.payload.payment.entity.amount){
        Balance.updateOne({qrID: req.body.payload.qr_code.entity.id},{$inc: {balance: req.body.payload.payment.entity.amount}},async function(err,res){
            if(err){
                console.log(err);
            }else{
                var transactionID = Math.floor(Math.random() * 9000000000) + 1000000000;
                var username = (await Balance.findOne({qrID: req.body.payload.qr_code.entity.id})).username;

                var walletHistory = new WalletHistory({
                    transactionID:  transactionID,
                    amount: req.body.payload.payment.entity.amount,
                    date: getformattedDate(),
                    time: getformattedTime(),
                    username: username,
                });
        
                walletHistory.save();
            }
        });
    }
    res.sendStatus(200);
});

app.get("/deposit",async(req,res)=>{
    if(req.user && req.user.isBlocked){
        res.render("blocked");
    }else if(req.isAuthenticated()){
        var balance = await Balance.findOne({username:req.user.username});
        balance = balance.balance/100;
        res.render("deposit and withdraw/deposit",{balance:balance,preDefinedDeposit: false,redirectTo: false, email: req.user.email,name: req.user.name,username: req.user.username});
    }else{
        res.redirect("/");
    }
});

app.post("/deposit",(req,res)=>{
    if(req.isAuthenticated() && !req.user.isBlocked){
        var amount = req.body.amount;
    
        var options = {
            amount: amount, 
            currency: "INR",
        };
    
        instance.orders.create(options, function(err, order) {
            if(err){
                res.send(err);
            }else{
                res.send({order_id: order.id});
            }
        });
    }
});

app.post("/payment/callback",(req,res)=>{
    
    if(req.user.isBlocked){
        res.render("blocked");
    }else if(req.isAuthenticated()){
        instance.payments.fetch(req.body.razorpay_payment_id).then((paymentDocument)=>{
            if(paymentDocument && paymentDocument.captured){
                var amount = paymentDocument.amount;
                Balance.updateOne({username: req.user.username},{$inc: {balance: amount}},function(err,res){
                    if(err){
                        res.send(err);
                    }
                });

                var transactionID = Math.floor(Math.random() * 9000000000) + 1000000000;

                var walletHistory = new WalletHistory({
                    transactionID:  transactionID,
                    amount: amount,
                    date: getformattedDate(),
                    time: getformattedTime(),
                    username: req.user.username,
                });
        
                walletHistory.save();

                if(req.body.redirectTo){
                    res.redirect(req.body.redirectTo);
                }else{
                    res.redirect("/paymentSuccessfull/"+ transactionID);
                }
            }else{
                res.redirect("/paymentFailed");
            }
        });
    }
});

app.get("/paymentSuccessfull/:transactionID",async(req,res) => {
    if(req.user.isBlocked){
        res.render("blocked");
    }else if(req.isAuthenticated()){
        var history = await WalletHistory.findOne({transactionID: req.params.transactionID});
        if(history.username == req.user.username || req.user.isAdmin){
            res.render("deposit and withdraw/paymentSuccessfull",{transactionID: req.params.transactionID, date : history.date , amount: history.amount});   
        }else{
            res.sendStatus(403);
        }
    }
});

app.get("/paymentFailed",(req,res) => {
    if(req.user.isBlocked){
        res.render("blocked");
    }else if(req.isAuthenticated()){
        res.render("deposit and withdraw/paymentFailed",{});   
    }
});


// WITHDRAW MONEY ROUTES
app.get("/withdraw",async(req,res)=>{
    var isEnabled = (await AdminOption.findOne({type: 'default options'})).withdrawEnabled;
    if(isEnabled){
        if(req.user && req.user.isBlocked){
            res.render("blocked");
        }else if(req.isAuthenticated()){
            Balance.findOne({username: req.user.username},{_id:0,balance:1},function(err,snapshot){
                res.render("deposit and withdraw/withdraw",{balance:(snapshot.balance/100)});
            });
        }else{
            req.session.current_url = "/withdraw";
            res.redirect("/login");
        }
    }else{
        res.send('service disabled');
    }
});

app.post("/withdraw",async(req,res)=>{
    var isEnabled = (await AdminOption.findOne({type: 'default options'})).withdrawEnabled;

    if(isEnabled){
        if(req.isAuthenticated() && !req.user.isBlocked){
            var params = req.body;
            //paisa to rupee
            params.amount = params.amount * 100;

            var userBalance = await Balance.findOne({username: req.user.username});

            if(userBalance.balance >= params.amount){

                instance.api.post({
                    url:"/contacts",
                    data:{
                        name: req.user.name,
                        email: req.user.email,
                        contact: req.user.username,
                    }
                },function(err1,res1){
                    if(err1){
                        res.send(err1.error.description);
                    }else{
                        var contact_id = res1.id;
                        instance.api.post({
                            url:"/fund_accounts",
                            data:{
                                contact_id:contact_id,
                                account_type:"vpa",
                                vpa:{address:params.VPA}
                            }
                        },function(err2,res2){
                            if(err2){
                                res.send(err2.error.description);
                            }else{
                                var fundAccountId = res2.id;
                                instance.api.post({
                                    url:"/payouts",
                                    data:{
                                        account_number: process.env.RAZORPAY_ACCOUNT_NUMBER,
                                        fund_account_id: fundAccountId,
                                        amount: params.amount  - (params.amount * 4.5) / 100,
                                        currency: "INR",
                                        mode: "UPI",
                                        purpose: "payout",
                                    }
                                },function(err3,res3){
                                    if(err3){
                                        res.send(err3.error.description);
                                    }else{
                                        instance.api.get({
                                            url:"/payouts/"+res3.id,
                                        },function(errFetchingPayout,fetchedPayout){
                                            if(errFetchingPayout){
                                                res.send(errFetchingPayout);
                                            }else{
                                                Balance.updateOne({username: req.user.username},{$inc: {balance: (-1 * params.amount)}},function(err,res){});
                                                
                                                var walletHistory = new WalletHistory({
                                                    transactionID:  Math.floor(Math.random() * 9000000000) + 1000000000,
                                                    amount: -1 * params.amount,
                                                    date: getformattedDate(),
                                                    time: getformattedTime(),
                                                    username: req.user.username,
                                                    pending: fetchedPayout == "processed" ? false : true,
                                                    payoutID: fetchedPayout.id
                                                });
                                                walletHistory.save();
        
                                                res.redirect("/walletHistory");
                                            }
                                        });
                                    }
                                });
                            }
                        })
                    }
                });

            }else{
                res.send("insufficient balance");
            }
    
        }else{
            res.sendStatus(403);
        }
    }else{
        res.send('service disabled');
    }
});

app.get('/transfer',async(req,res)=>{
    var isEnabled = (await AdminOption.findOne({type: 'default options'})).transferEnabled;
    if(isEnabled){
        if(req.user && req.user.isBlocked){
            res.render("blocked");
        }else if(req.isAuthenticated()){
            Balance.findOne({username: req.user.username},{_id:0,balance:1},function(err,snapshot){
                res.render('deposit and withdraw/transfer',{balance: (snapshot.balance/100)});
            });
        }else{
            req.session.current_url = "/transfer";
            res.redirect("/login")
        }
    }else{
        res.send('service disabled');
    }
});

app.post('/transfer',async(req,res)=>{
    var isEnabled = (await AdminOption.findOne({type: 'default options'})).transferEnabled;
    if(isEnabled){
        if(req.user && req.user.isBlocked){
            res.send("your account was blocked.Please contact support");
        }else if(req.isAuthenticated()){
            var validID = await Balance.findOne({walletID: req.body.walletID});
            if(validID){
                Balance.updateOne({username: req.user.username},{$inc: {balance: (-100 * req.body.amount)}},function(err1,res1){
    
                    var walletHistory = new WalletHistory({
                        transactionID:  Math.floor(Math.random() * 9000000000) + 1000000000,
                        amount: -100 * req.body.amount,
                        date: getformattedDate(),
                        time: getformattedTime(),
                        username: req.user.username,
                        transferredTo: req.body.walletID 
                    });
                    walletHistory.save();
    
                    Balance.updateOne({walletID: req.body.walletID},{$inc: {balance: (100 * req.body.amount)}},async function(err2,res2){
                        var userWalletID = (await Balance.findOne({username: req.user.username})).walletID;
    
                        var walletHistory = new WalletHistory({
                            transactionID:  Math.floor(Math.random() * 9000000000) + 1000000000,
                            amount: req.body.amount * 100,
                            date: getformattedDate(),
                            time: getformattedTime(),
                            username: validID.username,
                            transferredFrom: userWalletID
                        });
                        walletHistory.save();
    
                        res.redirect('/profile'); 
                    });
                });
            }else{
                res.send('invalid wallet id');
            }
        }else{
            res.sendStatus(403)
        }
    }else{
        res.send('service disabled');
    }
});

// RAZORPAY WEBHOOK URL
app.post("/withdraw/webhooks",(req,res)=>{
    if(req.body.event == "payout.processed"){
        WalletHistory.updateOne({payoutID: req.body.payload.payout.entity.id},{ $set: {pending: false} },(err,res)=>{});
    }
    res.sendStatus(200);
});

// KYC ROUTES
app.get("/kyc",async(req,res)=>{
    var isEnabled = (await AdminOption.findOne({type: 'default options'})).kycEnabled;
    if(isEnabled){
        if(req.user && req.user.isBlocked){
            res.render("blocked");
        }else if(req.isAuthenticated()){
            KYC.findOne({username: req.user.username},{_id:0,status:1},function(err,fetchedStatus){
                if(fetchedStatus){
                    res.render("kyc",{user:req.user.username,status:fetchedStatus.status});
                }else{
                    res.render("kyc",{user:req.user.username,status:null});
                }
            });
        }else{
            req.session.current_url = "/kyc";
            res.redirect("/login");
        }
    }else{
        res.send('service disabled');
    }
});

app.post("/kyc",async(req,res)=>{
    var isEnabled = (await AdminOption.findOne({type: 'default options'})).kycEnabled;
    if(isEnabled){
        if(req.isAuthenticated() && !req.user.isBlocked){
            var params = req.body;
            var nowDate = new Date(); 
            var date = + nowDate.getDate()+"/"+(nowDate.getMonth()+1)+"/"+nowDate.getFullYear();
            var kycForm = new KYC({
                username:req.user.username,
                name:params.name,
                aadhar_no:params.aadhar_no,
                pan_no: params.pan_no,
                bank_name: params.bank_name,
                ac_holder_name: params.ac_holder_name,
                account_username: params.account_username,
                ifsc_code: params.ifsc_code,
                aadhar_1: params.aadhar_1,
                aadhar_2: params.aadhar_2,
                bank_passbook_or_cancelled_check: params.bank_passbook_or_cancelled_check,
                your_selfie: params.your_selfie,
                status:"pending",
                date
            });
            kycForm.save();
        }
    }else{
        res.send('service disabled');
    }
});


// BUY PRODUCT ROUTES
app.get("/products/:itemName",async(req,res)=>{
    var product = await Product.findOne({name:req.params.itemName});
    if(product){
        res.render("product",{product:product});
    }else{
        res.send("product not found");
    }
});


app.get("/products/:itemName/buy",async(req,res)=>{
    if(req.isAuthenticated()){
        var balance = (await Balance.findOne({username: req.user.username})).balance;
        var price = (await Product.findOne({name: req.params.itemName})).price;
        var addresses = (await User.findOne({username:req.user.username})).addresses;
        if(price){
            res.render("buy",{itemName: req.params.itemName,price: price,balance: balance/100,addresses: addresses, size: req.query.size, color: req.query.color});
        }else{
            res.send("product not found");
        }
    }else{
        req.session.current_url = "/products/"+req.params.itemName+"/buy";
        res.redirect("/login");
    }
});


app.post("/products/:itemName/buy",async(req,res)=>{
    if(req.isAuthenticated()){
        var product = await Product.findOne({name:req.params.itemName});
        if(product){
        //save address if not already on db

        var addresses = (await User.findOne({username: req.user.username})).addresses;

        var matched = false;
        addresses.forEach((address)=>{
            if(address.address == req.body.address && address.city == req.body.city && address.pin_code == req.body.pin_code){
                matched = true
            }
        });

        if(matched == false){
            User.updateOne({username: req.user.username},
            { $push: { addresses : {address:req.body.address,city: req.body.city,pin_code: req.body.pin_code} } }
            ,function(){});
        }

        var userBalance = (await Balance.findOne({username: req.user.username})).balance/100;
            if(userBalance >= product.price){
                var nowDate = new Date(); 
                var date = + nowDate.getDate()+"/"+(nowDate.getMonth()+1)+"/"+nowDate.getFullYear();

                var address = {
                    address: req.body.address,
                    city: req.body.city,
                    pincode: req.body.pin_code
                };

                var orderNo = randomatic('0',4);
    
                order = new Order({
                    orderNo: orderNo,
                    item: product.name,
                    price: product.price,
                    date: date,
                    username: req.user.username,
                    thumbnail: product.images[0],
                    address: address,
                    size: req.query.size,
                    color: req.query.color
                });

                order.save();

                var walletHistory = new WalletHistory({
                    transactionID:  Math.floor(Math.random() * 9000000000) + 1000000000,
                    amount: -100* product.price,
                    date: getformattedDate(),
                    time: getformattedTime(),
                    username: req.user.username,
                    spentOnOrder: true
                });
                walletHistory.save();

                var amountToDeduct = (product.price * 100) * -1;
                Balance.updateOne({username: req.user.username},{ $inc: {balance: amountToDeduct} },()=>{});

                res.redirect("/orderSuccessful/"+orderNo);

            }else{
                //product price - current balance
                var amount = product.price - userBalance;
                
                res.render("deposit and withdraw/deposit",{balance: userBalance,preDefinedDeposit: amount,redirectTo: req.url,  email: req.user.email,name: req.user.name,username: req.user.username});
            }
        }else{
            res.sendStatus(403);
        }
    }else{
        req.session.current_url = "/products/"+req.params.itemName+"/buy";
        res.redirect("/login")
    }
});

app.get("/orderSuccessful/:orderNo",async(req,res)=>{
    if(req.isAuthenticated()){
        var orderDetails = await Order.findOne({orderNo: req.params.orderNo});
        if(orderDetails.username == req.user.username){
            res.render("orderSuccessful",{orderNo: orderDetails.orderNo,amount: orderDetails.price,itemName: orderDetails.item});
        }else{
            res.sendStatus(403);
        }
    }else{
        res.redirect("/");
    }
});

app.get("/logout",function(req,res){
    req.session.cookie.maxAge = 0;
    req.logout();
    res.redirect("/");
});

app.get('/about-us',(req,res)=>{
    res.render('others/aboutUs');
});

app.get('/return-refunds',(req,res)=>{
    res.render('others/returnRefunds');
});

app.get('/terms-conditions',(req,res)=>{
    res.render('others/termsConditions');
});

app.get('/privacy-policy',(req,res)=>{
    res.render('others/privacyPolicy');
});

//api part starts
app.get('/api/dashboard',async(req,res)=>{
    if(req.isAuthenticated()){
        var balance = await Balance.findOne({username: req.user.username});
        var transactions = await MerchantTransaction.find({merchantUsername: req.user.username});
        res.render('api/dashboard',{isMerchant: req.user.liveApiKey == null ? false : true,liveApiKey: req.user.liveApiKey,testApiKey: req.user.testApiKey,balance: balance.balance, testBalance: balance.testBalance,transactions: transactions, approvedMerchant: req.user.approvedMerchant});
    }else{
        req.session.current_url = "/api/dashboard";
        res.redirect('/login');
    }
});

app.get('/api/documentation',async(req,res)=>{
    res.render('api/documentation',{});
});

app.get('/api/enable',async(req,res)=>{
    if(req.isAuthenticated()){
        if(!req.user.liveApiKey){
            var liveApiKey = generateApiKey({length: 64, prefix: 'live'});
            var testApiKey = generateApiKey({length: 64, prefix: 'test'});
            await User.updateOne({username: req.user.username},{$set: {liveApiKey: liveApiKey, testApiKey: testApiKey, approvedMerchant: 'pending'}});
            await Balance.updateOne({username: req.user.username},{$set:{testBalance: 0}});
        }
        res.redirect('/api/dashboard');
    }else{
        req.session.current_url = "/api/dashboard";
        res.redirect('/login');
    }
});

app.get('/admin/api/approve',async(req,res)=>{
    if(req.isAuthenticated()){
        if(req.user.isAdmin){
            var merchants = await User.find({approvedMerchant: {$exists: true}});
            var data = [];
            merchants.forEach((merchant)=>{
                data.push({
                    username: merchant.username,
                    status: merchant.approvedMerchant
                });
            })
            res.render('api/approve',{merchants: data});
        }else{
            res.redirect('/');
        }
    }else{
        req.session.current_url = "/api/dashboard";
        res.redirect('/login');
    }
});


app.get("/admin/api/approve/:username",async(req,res)=>{
    if(req.isAuthenticated() && req.user.isAdmin){
        await User.updateOne({username: req.params.username},{$set:{approvedMerchant: "approved"}});
        res.redirect("/admin/api/approve");
    }else{
        res.redirect("/");
    }
});

app.get("/admin/api/reject/:username",async(req,res)=>{
    if(req.isAuthenticated() && req.user.isAdmin){
        await User.updateOne({username: req.params.username},{$set:{approvedMerchant: "rejected"}});
        res.redirect("/admin/api/approve");
    }else{
        res.redirect("/");
    }
});

app.post('/api/addTestBalance',async(req,res)=>{
    if(req.isAuthenticated()){
        if(req.user.liveApiKey){
            await Balance.updateOne({username: req.user.username},{$inc: {testBalance: req.body.amount}});
        }
        res.redirect('/api/dashboard');
    }else{
        req.session.current_url = "/api/dashboard";
        res.redirect('/login');
    }
});

//>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>live api routes<<<<<<<<<<<<<<<<<<<<<<<<<<
app.post('/api/payments',async(req,res)=>{
    var apiKey = req.headers.authorization != null ? req.headers.authorization.replace('Bearer ','') : false;
    if(!apiKey){
        res.status(400).json({ message: 'api key not provided' });
    }else{
        var apiUser = await User.findOne({$or: [{liveApiKey: apiKey},{testApiKey: apiKey}]});

        if(!apiUser){
            res.status(400).json({ message: 'invalid api key' });
        }else{
            if(!req.body.username){
                res.status(400).json({ message: 'username field is required' });
            }else{

                var validClient = await User.findOne({username: req.body.username});

                if(!validClient){
                    res.status(400).json({ message: 'user dosent exist' });
                }else{

                    if(apiUser.username == req.body.username){
                        res.status(400).json({ message: 'merchants and users number match. Cant make payment to yourself' });
                    }else{


                        if(!req.body.amount){
                            res.status(400).json({ message: 'amount field is required'});
                        }else{
    
                            if(req.body.amount < 100){
                                res.status(400).json({ message: 'amount cant be less than 100(paisa) ie 1rs'});
                            }else{
                                
                                var paymentID = generateApiKey({length: 64, prefix: 'payment_id'});
                                var otp = generateOTP();
    
                                axios({
                                    url: "https://www.fast2sms.com/dev/bulkV2",
                                    method: "post",
                                    headers: {"authorization": process.env.FAST2SMS_AUTH},
                                    data: {
                                        "variables_values": otp,
                                        "route": "otp",
                                        "numbers": req.body.username,
                                    }
                                });
    
                                var payment = new APIPayment({
                                    paymentID: paymentID,
                                    username: req.body.username,
                                    amount: req.body.amount,
                                    apiKey: apiKey,
                                    otp: otp
                                });
    
                                payment.save();
    
                                res.send(paymentID);
    
                            }
    
                        }

                    }

                }

            }

        }

    }

});

app.post('/api/payments/verify',async(req,res)=>{
    var apiKey = req.headers.authorization != null ? req.headers.authorization.replace('Bearer ','') : false;
    if(!apiKey){
        res.status(400).json({ message: 'api key not provided'});
    }else{
        var apiUser = await User.findOne({$or: [{liveApiKey: apiKey},{testApiKey: apiKey}]});

        if(!apiUser){
            res.status(400).json({ message: 'invalid api key'});
        }else{

            if(!req.body.paymentID){
                res.status(400).json({ message: 'paymentID field is required'});
            }else{

                var payment = await APIPayment.findOne({
                    paymentID: req.body.paymentID,
                    apiKey: apiKey
                });
    
                if(!payment){
                    res.status(400).json({ message: 'invalid payment id'});
                }else{

                    if(!req.body.otp){
                        res.status(400).json({ message: 'otp field is required'});
                    }else{

                        if(payment.otp != req.body.otp){
                            res.status(400).json({ message: 'incorrect otp'});
                        }else{
        
                            if(payment.apiKey.includes('test.')){
        
                                var userBalance = await Balance.findOne({username: payment.username});
        
                                if(userBalance.testBalance < payment.amount){
                                    res.status(400).json({ message: "insufficient balance in user's account"});
                                }else{
        
                                    await Balance.updateOne({username: payment.username},{$inc:{testBalance: payment.amount * -1}});
                                    await Balance.updateOne({username: apiUser.username},{$inc:{testBalance: payment.amount}});
                                    await APIPayment.deleteOne({paymentID: req.body.paymentID,apiKey: apiKey});
                                    
                                    res.send('payment successfull');
        
                                }
        
                            }else{
        
                                var userBalance = await Balance.findOne({username: payment.username});
        
                                if(userBalance.balance < payment.amount){
                                    res.status(400).json({ message: "insufficient balance in user's account"});
                                }else{
                                    
                                    if(apiUser.approvedMerchant != "approved"){
                                        res.status(400).json({ message: "merchant account not approved"});
                                    }else{

                                        await Balance.updateOne({username: payment.username},{$inc:{balance: payment.amount * -1}});
                                        await Balance.updateOne({username: apiUser.username},{$inc:{balance: payment.amount}});
                                        await APIPayment.deleteOne({paymentID: req.body.paymentID,apiKey: apiKey});
                                        
                                        var transactionID = Math.floor(Math.random() * 9000000000) + 1000000000;
                        
                                        var walletHistory = new WalletHistory({
                                            transactionID:  transactionID,
                                            amount: payment.amount * -1,
                                            date: getformattedDate(),
                                            time: getformattedTime(),
                                            username: payment.username,
                                            spentOnOrder: true
                                        });
                                
                                        walletHistory.save();

                                        var merchantTransaction = new MerchantTransaction({
                                            transactionID:  transactionID,
                                            amount: payment.amount,
                                            username: payment.username,
                                            merchantUsername: apiUser.username,
                                            date: getformattedDate(),
                                            time: getformattedTime(),
                                        });
                                
                                        merchantTransaction.save();

                                        var walletHistory = new WalletHistory({
                                            transactionID:  transactionID,
                                            amount: payment.amount,
                                            date: getformattedDate(),
                                            time: getformattedTime(),
                                            username: apiUser.username,
                                            collectedFromMerchant: payment.username
                                        });
                                
                                        walletHistory.save();
            
                                        res.send('payment successfull');

                                    }
        
                                }
        
                            }
        
        
                        }

                    }
    
                }

            }

        }
    }

});

app.post('/api/payouts',async(req,res)=>{
    var apiKey = req.headers.authorization != null ? req.headers.authorization.replace('Bearer ','') : false;
    if(!apiKey){
        res.status(400).json({ message: 'api key not provided' });
    }else{
        var apiUser = await User.findOne({$or: [{liveApiKey: apiKey},{testApiKey: apiKey}]});

        if(!apiUser){
            res.status(400).json({ message: 'invalid api key' });
        }else{
            if(!req.body.username){
                res.status(400).json({ message: 'username field is required' });
            }else{

                var validClient = await User.findOne({username: req.body.username});

                if(!validClient){
                    res.status(400).json({ message: 'user dosent exist' });
                }else{

                    if(apiUser.username == req.body.username){
                        res.status(400).json({ message: 'merchants and users number match. Cant make payout to yourself' });
                    }else{

                        if(!req.body.amount){
                            res.status(400).json({ message: 'amount field is required'});
                        }else{
    
                            if(req.body.amount < 100){
                                res.status(400).json({ message: 'amount cant be less than 100(paisa) ie 1rs'});
                            }else{

                                if(apiKey.includes('test.')){
            
                                    if(apiUser.testBalance < req.body.amount){
                                        res.status(400).json({ message: "insufficient balance in merchant's account"});
                                    }else{
        
                                        await Balance.updateOne({username: apiUser.username},{$inc:{testBalance: req.body.amount  * -1}});
                                        await Balance.updateOne({username: req.body.username},{$inc:{testBalance: req.body.amount}});
        
                                        res.send('payout successfull');
        
                                    }

                                }else{
                                                
                                    if(apiUser.balance < req.body.amount){
                                        res.status(400).json({ message: "insufficient balance in merchant's account"});
                                    }else{

                                        if(apiUser.approvedMerchant != "approved"){
                                            res.status(400).json({ message: "merchant account not approved"});
                                        }else{

                                            await Balance.updateOne({username: apiUser.username},{$inc:{balance: req.body.amount  * -1}});
                                            await Balance.updateOne({username: req.body.username},{$inc:{balance: req.body.amount}});
            
                                            var transactionID = Math.floor(Math.random() * 9000000000) + 1000000000;
            
                                            var walletHistory = new WalletHistory({
                                                transactionID:  transactionID,
                                                amount: req.body.amount,
                                                date: getformattedDate(),
                                                time: getformattedTime(),
                                                username: req.body.username,
                                                payoutFromMerchant: apiUser.username
                                            });
                                    
                                            walletHistory.save();
            
                                            var merchantTransaction = new MerchantTransaction({
                                                transactionID:  transactionID,
                                                amount: req.body.amount * -1,
                                                username: req.body.username,
                                                merchantUsername: apiUser.username,
                                                date: getformattedDate(),
                                                time: getformattedTime(),
                                            });
                                    
                                            merchantTransaction.save();
            
                                            var walletHistory = new WalletHistory({
                                                transactionID:  transactionID,
                                                amount: req.body.amount * -1,
                                                date: getformattedDate(),
                                                time: getformattedTime(),
                                                username: apiUser.username,
                                                payoutToMerchant: req.body.username
                                            });
                                    
                                            walletHistory.save();
            
                                            res.send('payout successfull');

                                        }
        
                                    }

                                }
    
                            }
    
                        }

                    }

                }

            }

        }

    }

});


// >>>>>>>>>>>>>>>>>>>>>>>>>>>SUPPORT CHAT<<<<<<<<<<<<<<<<<<<<<<<<<<<

//socket.io
io.on("connection",socket => {

    socket.on("join room", roomName => {
        socket.join(roomName);
    });

    socket.on("new message",async message => {

        var chat = new Chat({
            username: message.username,
            message:message.message,
            fromAdmin: message.fromAdmin, 
        });

        chat.save();


        if(message.fromAdmin){
            await User.updateOne({username: message.username},{$set:{unreadMessages: true}});
        }else{
            await User.updateOne({username: message.username},{$set:{newMessages: true}});
        }

        io.sockets.in(message.username).emit("new message",chat);
        if(!chat.fromAdmin){
            io.sockets.in('admin').emit("new message",chat);
        }
    });

    socket.on("mark seen",async data =>{
        if(data.isAdmin){
            await User.updateOne({username: data.username},{$set: {newMessages: false}});
        }else{
            await User.updateOne({username: data.username},{$set: {unreadMessages: false}});
        }

        if(data.isAdmin){
            io.sockets.in('admin').emit("mark seen",data.username);
        }
    });

});

app.get('/support',async(req,res)=>{
    if(req.isAuthenticated()){
        if(!req.user.isAdmin){
            var messages = await Chat.find({username: req.user.username});
            res.render('support',{messages: messages, username: req.user.username, isAdmin: false});
        }else{
            res.redirect('/admin/support');
        }
    }else{
        res.redirect('/login');
    }
});

app.get('/admin/support',async(req,res)=>{
    if(req.isAuthenticated()){
        if(req.user.isAdmin){
            var users = await User.find();
            var data = []; 

            for (let index = 0; index < users.length; index++) {
                if(users[index].newMessages){
                    data.splice(0,0,{
                        username: users[index].username,
                        newMessages: users[index].newMessages,
                        name: users[index].name
                    });
                }else{
                    var hasMessagedSupport = await Chat.findOne({username: users[index].username});

                    if(hasMessagedSupport != null){
                        data.push({
                            username: users[index].username,
                            newMessages: users[index].newMessages,
                            name: users[index].name
                        });
                    }
                }
            }

            res.render('admin/support',{users: data});
        }else{
            res.redirect('/support');
        }
    }else{
        res.redirect('/login');
    }
});

app.get('/admin/support/:username',async(req,res)=>{
    if(req.isAuthenticated()){
        if(req.user.isAdmin){
            var userExists = await User.findOne({username: req.params.username});
            if(userExists){
                var messages = await Chat.find({username: req.params.username});
                res.render('support',{messages: messages, username: req.params.username, isAdmin: true});
            }else{
                res.send("user dosent exist");
            }
        }else{
            res.redirect('/support');
        }
    }else{
        res.redirect('/login');
    }
});

app.get('/admin/user/:username',async(req,res)=>{
    if(req.isAuthenticated()){
        if(req.user.isAdmin){
            var user = await User.findOne({username: req.params.username});
            if(user){
                var balance = await Balance.findOne({username: req.params.username});
                var transactions = await WalletHistory.find({username: req.params.username});
                res.render('admin/userInfo',{username: user.username, name: user.name,email: user.email, merchant: user.approvedMerchant, isAdmin: user.isAdmin, balance: balance.balance,transactions: transactions,addresses: user.addresses});
            }else{
                res.send("user dosent exist");
            }
        }else{
            res.redirect('/');
        }
    }else{
        res.redirect('/login');
    }
});

app.post('/searchUser' , async(req , res) => {
    let query = req.body.search 
    // let result = await Balance.findOne({walletID : query}) 
    try {
        let resu = await Balance.findOne({username : query}) 
        // console.log(result)
        if(resu !== null){
            let userdata = await User.findOne({username : query}) 
            let wallethistory = await WalletHistory.findOne({username : query}) 
            console.log(resu);
            res.render('others/search' , {res : resu ,user : userdata , wallethistory : wallethistory })
        }else{
            let resu = await Balance.findOne({walletID : query}) 
            console.log(resu);
            res.send(resu)
        }
    } catch (error) {
        res.send(error)
    }
   return
   
    // res.send(result)
  
})




app.get("*",(req,res)=>{
    res.send("page not found");
});

app.post("*",(req,res)=>{
    res.send("invalid api route");
});

var server = http.listen(process.env.PORT || 3000, () => {
    console.log('server is running on port', server.address().port);
});


















