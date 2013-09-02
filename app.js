
/**
 * Module dependencies.
 */

var express = require('express.io')
  , http = require('http')
  , path = require('path')
  , passport = require('passport')
  , FacebookStrategy = require('passport-facebook').Strategy
  , TwitterStrategy = require('passport-twitter').Strategy
  , redis = require('redis')
  , RedisStore = require('connect-redis')(express)
  , cookieParser = require('connect').utils.parseSignedCookies
  , cookie = require("cookie")
  , async = require("async")
  , config = require('./config.json');

var client = exports.client = redis.createClient();
var sessionStore = new RedisStore({client : client});
var game_lock = false;
var app = express();
app.http().io();
// all environments



app.configure(function(){
	app.set('views', __dirname + '/views');
	app.set('view engine', 'jade');
	app.use(express.favicon());
	app.use(express.logger('dev'));
	app.use(express.bodyParser());
	app.use(express.methodOverride());
	app.use(express.cookieParser("peekawoo"));
	app.use(express.session({ 
		key: "peekawoo",
		store : sessionStore
		}));
	app.use(passport.initialize());
	app.use(passport.session());
	
	app.use(express.static(path.join(__dirname, 'public')));
	app.use(app.router);
});

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

passport.serializeUser(function(user, done) {
	done(null, user);
});

passport.deserializeUser(function(obj, done) {
	done(null, obj);
});
	
passport.use(new FacebookStrategy(config.fb,
  function(accessToken, refreshToken, profile, done) {
	profile.photourl = 'http://graph.facebook.com/'+profile.username+'/picture';
	console.log("+++facebook profileurl+++");
	console.log(profile.photourl);
    return done(null, profile);
  }
));

passport.use(new TwitterStrategy(config.tw,
  function(accessToken, refreshToken, profile, done) {
	profile.photourl = 'http://graph.facebook.com/'+profile.username+'/picture';
	console.log("+++facebook profileurl+++");
	console.log(profile.photourl);
    return done(null, profile);
  }
));

app.get("/",function(req,res){
	res.render('subscribe');
});

app.get("/login",function(req,res){
	res.render('login');
});
app.get('/authfb',
  passport.authenticate('facebook'));

app.get('/authtw',
		  passport.authenticate('twitter'));

app.get('/authfb/callback',
		passport.authenticate('facebook', { failureRedirect: '/login' }),
		function(req, res) {
			res.redirect('/option');
});

app.get('/authtw/callback',
		passport.authenticate('twitter', { failureRedirect: '/login' }),
		function(req, res) {
			res.redirect('/option');
});

app.get('/subscribe2',function(req,res){
	console.log("+++++SUBSCRIBE+++++");
	console.log(req.user);
	console.log(req.query);
	client.sadd("email",req.query.inputBox);
	res.render('subscribe2');
});

app.get('/option',function(req,res){
	res.render('option',{profile:req.session.passport.user.gender,provider:req.session.passport.user.provider});
});
app.get('/loading',function(req,res){
	req.user.gender = req.query["gender-m"] || req.query["gender-f"] || req.user._json.gender;
	req.user.codename = req.query.codename || req.user.codename;
	res.render('loading',{user: req.user});
});

app.get('/ranking',function(req,res){
	var user = req.user;
	client.smembers('visitor:'+user.id,function(err,data){
		console.log("+++++Data Content Query+++++");
		console.log(data);
		console.log("+++++Data Content After Parse+++++");
		console.log(data);
		var up = {};
		up.id = user.id;
		up.username = user.username;
		up.gender = user.gender;
		up.photourl = user.photourl;
		up.provider = user.provider;
		up.codename = user.codename;
		console.log("+++++UP content+++++");
		console.log(up);
		res.render('ranking',{user:up,chatmate:data});
	});
});

app.get('/chat/:room',function(req,res){
	console.log("******req.params.room******");
	console.log(req.params.room);
	client.smembers(req.params.room,function(err,data){
		console.log(err);
		console.log(data);
		if(!data[0]){
			data = {};
		}
		else{
			data = JSON.parse(data[0]);
		}
		console.log(data);
		console.log(req.user.photourl);
		var up = {};
		if(req.user.provider=='twitter'){
			gender = req.user.gender
			console.log("****GENDER IF Twitter USE****");
			console.log(gender);
			console.log("data."+gender+".gender");
			//up.gender = "data."+gender+".gender"
		}
		else{
			
			up.gender = req.user.gender;
		}
		up.id = req.user.id;
		up.username = req.user.username;
		up.photourl = req.user.photourl;
		up.provider = req.user.provider;
		up.codename = req.user.codename;
		res.render('chat',{user: up,room : data});
	});
	
});

app.io.set('log level', 1);
app.io.set('authorization', function (handshakeData, callback) {
	if(handshakeData.headers.cookie){
	//	console.log(handshakeData.headers.cookie);
	//	var cookies = cookieParser(cookie.parse(handshakeData.headers.cookie), "peekawoo"),
		console.log(handshakeData.headers.cookie);
		var cookies = handshakeData.headers.cookie.replace("'","").split(";");
		if(cookies.length > 1){
			cookies = cookies[1].split("=");
		}
		else{
			cookies = cookies[0].split("=");
		}
		sid = cookies[1].replace("s%3A","").split(".")[0];
	//	sid = cookies["peekawoo"];

		sessionStore.load(sid, function(err,session){
			if(err || !session){
				return callback("Error retrieving session!",false);
			}
			handshakeData.peekawoo = {
					user : session.passport.user
			};
			return callback(null,true);
		});
	}
	else{
		return callback("No cookie transmitted.!",false);
	}
	
});

app.io.set('store', new express.io.RedisStore({
    redisPub: redis.createClient(),
    redisSub: redis.createClient(),
    redisClient: client
}));

app.io.sockets.on('connection',function(socket){
	console.log("===================");
	console.log(socket.handshake.peekawoo.user);
	console.log("===================");
	var user = socket.handshake.peekawoo.user;
	app.io.route('join',function(req){
		console.log("++++checking req.data.room ++++");
		console.log(req.data.room);
		req.io.join(req.data.room);
	});
	
	app.io.route('leave',function(req){
		console.log("++++signout req.data.room++++");
		console.log(req.data.room);
		console.log("++++signout req.data.user++++");
		console.log(req.data.user);
		console.log("+++++removing gender and room declare+++++");
		var removegender = req.data.user;
		var removeroom = req.data.room;
		console.log(removegender);
		console.log(removeroom);
		console.log("+++++removing gender+++++");
		delete removegender.codename;
		console.log(removegender);
		client.srem("visitor:"+removegender.gender,JSON.stringify(removegender));
		//client.srem(removeroom.name,JSON.stringify(removeroom));
		client.del(removeroom.name);
		console.log("@@@@@ D O N E  R E M O V I N G @@@@@");
	});
	
	app.io.route('insert',function(req){
		var user = req.data.user;
		var mate = req.data.mate;
		console.log("====user value====");
		console.log(user);
		console.log("====mate value====");
		console.log(mate);
		console.log("====remove if exist====");
		client.srem("visitor:"+mate.id,JSON.stringify(user));
		console.log("====add user to mate====");
		client.sadd("visitor:"+mate.id,JSON.stringify(user));
	});
	
	app.io.route('uninsert',function(req){
		var user = req.data.user;
		var mate = req.data.mate;
		console.log("====user value====");
		console.log(user);
		console.log("====mate value====");
		console.log(mate);
		console.log("====Delete me in my chatmate====");
		//client.smembers(mate.id,function(callback){
		//	console.log("====callback value====");
		//	console.log(callback);
		//});
		client.srem("visitor:"+mate.id,JSON.stringify(user));
		//client.sadd("visitor:"+mate.id,JSON.stringify(user));
	});
	
	app.io.route('my msg',function(req){
		app.io.room(getRoom(req)).broadcast('new msg', req.data);
	});

	app.io.route('member', function(req) {
		async.auto({
			setMember : function(callback){
				var user = JSON.parse(req.data);
				var up = {};
				up.id = user.id;
				up.username = user.username;
				up.gender = user.gender;
				up.photourl = user.photourl;
				up.provider = user.provider;
				client.srem("visitor:"+user.gender,JSON.stringify(up));
				client.sadd("visitor:"+user.gender,JSON.stringify(up));
				callback(null,true);
				
				console.log("+++++++checking+++++++");
				console.log(up);
				console.log("+++++++checking+++++++");
			},
			getMaleVisitor : function(callback){
				client.smembers("visitor:male",callback);
			},
			getFemaleVisitor : function(callback){
				client.smembers("visitor:female",callback);
			}
		},function(err,result){
			console.log(result);
			if(result.getMaleVisitor.length >= 1 && result.getFemaleVisitor.length >= 1){
				if(!game_lock){
					game_lock = true;
					console.log("starting game in 3 sec");
					setTimeout(function(){
						start_game();
					},60000);
				}
			}
		});
		
		
	});
});

start_chat = function(vf,vm,cycle){
	console.log("@@@@@@@@@@@@@ Chat start");
	
	async.auto({
		group_user : function(){
			var rooms = new Array();
			var new_vm = new Array();
			for(var i=0; i< vf.length; i++){
				if(vm[i+1]){
					new_vm.push(vm[i+1]);
				}
				
				if(vf[i] && vm[i]){
					var vfs = JSON.parse(vf[i]);
					var vms = JSON.parse(vm[i]);
					var room = {
						name : vms.id + "-" + vfs.id,
						male : vms,
						female : vfs
					};
					console.log("++++++getting blank room++++++");
					console.log(room);
					console.log("++++++++++++++++++++++++++++++");
					//client.srem(room.name,JSON.stringify(room),function(){
						
					//});
					client.srem(room.name,JSON.stringify(room));
					client.sadd(room.name,JSON.stringify(room));
					rooms.push(room);
					console.log("++++Locating image++++");
					console.log(room);
					console.log("++++++++++++++++++++++");
					app.io.broadcast(vfs.id, room);
					app.io.broadcast(vms.id, room);
					
					
				}
				else{
					if(vf[i]){
						var vfs = JSON.parse(vf[i]);
						app.io.broadcast(vfs.id, false);
						console.log("kickout: " + vfs.id);
					}
					if(vm[i]){
						var vms = JSON.parse(vm[i]);
						console.log("kickout: " + vms.id);
						app.io.broadcast(vms.id, false);
					}
				}
			}
			for(var j=i;j<vm.length;j++){
				if(vf[i]){
					var vfs = JSON.parse(vf[i]);
					app.io.broadcast(vfs.id, false);
					console.log("kickout: " + vfs.id);
				}
				if(vm[i]){
					var vms = JSON.parse(vm[i]);
					console.log("kickout: " + vms.id);
					app.io.broadcast(vms.id, false);
				}
			}
			new_vm.push(vm[0]);
			setTimeout(function(){
				console.log("@@@@@CYCLE@@@@@");
				console.log(cycle);
				console.log(rooms.length);
				cycle = cycle + 1;
				if(cycle < rooms.length){
					start_chat(vf,new_vm,cycle);
				}
				else{
					game_lock = false;
					app.io.broadcast('game_stop', true);
				}
				
			},60000);
		},
		
	},function(err,result){
		
	});
};

start_game = function(){
	async.auto({
		getMaleVisitor : function(callback){
			client.smembers("visitor:male",callback);
		},
		getFemaleVisitor : function(callback){
			client.smembers("visitor:female",callback);
		},
		assignRoom : ['getMaleVisitor','getFemaleVisitor',function(callback,result){
			var vf = result.getFemaleVisitor;
			var vm = result.getMaleVisitor;
			console.log("@@@@@@@@@@@@@ Room Assigned");
			console.log(vf);
			console.log(vm);
			console.log("@@@@@@@@@@@@@ Room Assigned");
			start_chat(vf,vm,0);
		}]
	});
};

function getRoom(req){
	var rooms = req.io.manager.roomClients[req.io.socket.id];
	var room = "";
	
	for(var i in rooms){
	if(i != '' && room == ""){
	room = i.replace('/','');
	}
	}
	console.log(room);
	return room;
	}

client.keys('*', function(err, keys) {
	if(keys){
		keys.forEach(function(key){client.del(key);});
	}
    
    console.log('Deletion of all redis reference ', err || "Done!");
});

app.listen(3000);
