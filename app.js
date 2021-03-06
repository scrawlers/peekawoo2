
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
var cycle = 0;
var rotationGame = 0;
var cycle_turn = false;
var app = express();
var newuser = false;
var topic = ["MOVIES","FOODS","PEOPLE","PLACES","GADGETS","COUNTRY","SCHOOL","LITERATURE"];
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
	//profile.photourl = 'http://graph.twitter.com/'+profile.username+'/picture';
	profile.photourl = profile.photos[0].value;
	console.log("+++twitter profileurl+++");
	console.log(profile.photourl);
    return done(null, profile);
  }
));

app.get("/",function(req,res){
	res.render('login');
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

app.get('/error',function(req,res){
	console.log("xxXXxx ERROR PAGE of Kickout xxXXxx");
	console.log(req.user);
	res.render('error');
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
	console.log("XXX---------------- req.user.gender -----------------XXX");
	console.log(req.user.gender);
	console.log("XXX---------------- req.user._json.gender -----------------XXX");
	console.log(req.user._json.gender);
	console.log("XXX---------------- req.query gender - m -----------------XXX");
	console.log(req.query["gender-m"]);
	console.log("XXX---------------- req.query gender - f -----------------XXX");
	console.log(req.query["gender-f"]);
	//if(!req.query["gender-m"] && !req.query["gender-f"])
	var genderStore = new Array();
	if(req.user.provider == 'facebook'){
		if(rotationGame === 0){
			console.log("XXX---------------- FACEBOOK GENDER DEFAULT -----------------XXX");
			req.user.gender = req.query["gender-m"] || req.query["gender-f"] || req.user._json.gender;
		}
		else{
			console.log("XXX---------------- FACEBOOK GENDER AUTOMATIC -----------------XXX");
			client.smembers("visitor:"+req.user.gender,function(err,datas){
				datas.forEach(function(data){
					if(req.user.id == JSON.parse(data).id){
						genderStore.push(JSON.parse(data).gender);
					}
				});
				if(!genderStore){
					req.user.gender = req.query["gender-m"] || req.query["gender-f"] || req.user._json.gender;
				}
			});
		}	
	}else{
		if(rotationGame === 0){
			console.log("XXX---------------- TWITTER GENDER DEFAULT -----------------XXX");
			req.user.gender = req.query["gender-m"] || req.query["gender-f"] || req.user._json.gender;
		}
		else{
			console.log("XXX---------------- TWITTER GENDER AUTOMATIC -----------------XXX");
			client.smembers("visitor:"+req.user.gender,function(err,datas){
				datas.forEach(function(data){
					if(req.user.id == JSON.parse(data).id){
						genderStore.push(JSON.parse(data).gender);
					}
				});
				if(!genderStore){
					req.user.gender = req.query["gender-m"] || req.query["gender-f"] || req.user._json.gender;
				}
			});
		}
	}
	
	req.user.codename = req.query.codename || req.user.codename;
	console.log("XXX---------------- LOADING -----------------XXX");
	console.log(req.user._json);
	console.log("XXX------------------------------------------XXX");
	console.log(req.user.gender);
	console.log("XXX------------------------------------------XXX");
	res.render('loading',{user: req.user});
});

app.get('/ranking',function(req,res){
	var user = req.user;
	console.log(req.user);
	var likes = new Array();
	var finalLikes = new Array();

	var finishedRequest = function(){
		var up = {};
		up.id = user.id;
		up.username = user.username;
		up.gender = user.gender;
		up.photourl = user.photourl;
		up.provider = user.provider;
		up.codename = user.codename;
		console.log("+++++UP content+++++");
		console.log(up);
		console.log("+++++UP content+++++");
		console.log(finalLikes);
		res.render('ranking',{user:up,chatmate:finalLikes});
	}
	
	client.smembers('visitor:'+user.id,function(err,datas){
		console.log("+++++Data Content Query+++++");
		console.log(datas);
		console.log(datas.length);
		var countData;
		countData = datas.length;
		console.log("xxXXxx Count Content Value xxXXxx");
		console.log(countData);
		if(countData > 0){
			datas.forEach(function(data){
				console.log("xxXXxx PEOPLE WHO LIKE YOU");
				console.log(data);
				//countData = data.length;
				//console.log(countData);
				likes.push(data);
				client.smembers('visitor:'+JSON.parse(data).id,function(err,liked){
					if(!liked[0]){
						console.log("xxXXxx NO ONE LIKE YOU xxXXxx");
						liked = {};
					}
					else{
						console.log("xxXXxx OTHER PEOPLE LIKE DATA xxXXxx");
						console.log(liked);
						liked.forEach(function(like){
							console.log("xxXXxx LIKE DATA xxXXxx");
							console.log(like);
							if(JSON.parse(like).id == req.user.id){
								console.log("xxXXxx RESULT OF LIKE xxXXxx");
								finalLikes.push(datas);
							}
						});
					} 
					countData-=1;
					if(countData <= 0){
						finishedRequest();
					}
				});
				
	
			});
		}else{
			finishedRequest();
		}
			
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
		var container;
		var listgender = new Array();
		if(req.user.gender == data.male.gender){
			container = data.female.gender;
		}else{
			container = data.male.gender;
		}
		client.smembers("visitor:"+container,function(err,results){
			console.log("****LIST of Opposite Gender****");
			console.log(listgender);
			results.forEach(function(key){
				console.log(key);
				console.log(JSON.parse(key));
				listgender.push(JSON.parse(key));
			});
			//outside the smembers put dated 9-4-13 10:22am
			console.log("****Complete List of Opposite Gender****");
			console.log(listgender);
			var up = {};
			//if(req.user.provider=='twitter'){
				gender = req.user.gender;
				console.log("****GENDER IF Twitter USE****");
				console.log(gender);
			//	console.log("data."+gender+".gender");
			//	up.gender = "data."+gender+".gender"
			//}
			//else{
				up.gender = req.user.gender;
			//}
			up.id = req.user.id;
			up.username = req.user.username;
			up.photourl = req.user.photourl;
			up.provider = req.user.provider;
			up.codename = req.user.codename;
			res.render('chat',{user: up, room: data, listgen: listgender});
			
		});
	});
	
});

app.io.set('log level', 1);
app.io.set('authorization', function (handshakeData, callback) {
	if(handshakeData.headers.cookie){
	//	console.log(handshakeData.headers.cookie);
	//	var cookies = cookieParser(cookie.parse(handshakeData.headers.cookie), "peekawoo"),
		console.log("xxXX Cookie XXxx");
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
			console.log("===== Connecting . . . =====");
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
		app.io.room(req.data.room).broadcast('roomtopic',topic[Math.floor(Math.random() * topic.length)]);
	});
	
	app.io.route('leave',function(req){
		console.log("++++signout req.data.room++++");
		console.log(req.data.room);
		console.log("++++signout req.data.user++++");
		console.log(req.data.user);
		console.log("+++++removing gender and room declare+++++");
		var removegender;
		if(req.data.user.id == req.data.room.male.id){
			removegender = req.data.room.male;
		}else{
			removegender = req.data.room.female;
		}
		
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
		//if(user.gender == 'male'){
		//	client.sadd("like:"+user.id+"-"+mate.id,JSON.stringify(user));
		//}
		//else{
		//	client.sadd("like:"+mate.id+"-"+user.id,JSON.stringify(user));
		//}
		
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
			checkIfExist : function(callback){
				var gender = JSON.parse(req.data);
				var me = {};
				me.id = gender.id;
				me.username = gender.username;
				me.gender = gender.gender;
				me.photourl = gender.photourl;
				me.provider = gender.provider;
				client.sismember("visitor:"+me.gender,JSON.stringify(me),callback);
			},
			setMember : function(callback){
				var user = JSON.parse(req.data);
				//var listGender = result.checkIfExist;
				var up = {};
				up.id = user.id;
				up.username = user.username;
				up.gender = user.gender;
				up.photourl = user.photourl;
				up.provider = user.provider;
				//console.log("xxXXxx CHECK IF EXIST xxXXxx");
				//console.log(listGender);
				//console.log(result.checkIfExist);
				//newuser = true;
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
			if(result.checkIfExist == 0){
				console.log("NOTHING");
				//client.sadd("visitor:"+user.gender,JSON.stringify(up));
				console.log("xxXXxx IM NEW HERE xxXXxx");
				newuser = true;
				
			}
			else{
				newuser = false;
			}
			if(result.getMaleVisitor.length >= 1 && result.getFemaleVisitor.length >= 1){
			//Change condition if male == female
				//if(result.getMaleVisitor.length == result.getFemaleVisitor.length){
				//cycle_game = Number((result.getMaleVisitor.length + result.getFemaleVisitor.length) /2) ;
				//if(cycle == cycle_game){
				//	game_lock = true;
				//}
				//else{
				//	cycle = cycle_game;
				//	game_lock = false;
				//}
				console.log(newuser);
				if(newuser){
					if(!game_lock){
						game_lock = true;
						console.log("starting game in 30 sec");
						setTimeout(function(){
							start_game();
						},15000);
					}
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
				console.log("female length");
				console.log(vf.length);
				console.log("female content");
				console.log(vf[i]);
				console.log("male content");
				console.log(vm[i]);
				if(vf[i] && vm[i]){
					var vfs = JSON.parse(vf[i]);
					var vms = JSON.parse(vm[i]);
					var room = {
						name : vms.id + "-" + vfs.id,
						male : vms,
						female : vfs
					};
					
					//if(cycle_turn){
					//	var vfs2,vms2;
					//	if(i===0){
					//		vfs2 = JSON.parse(vf[vf.length-1]);
					//		vms2 = JSON.parse(vm[vf.length-1]);
					//	}
					//	else{
					//		vfs2 = JSON.parse(vf[i-1]);
					//		vms2 = JSON.parse(vm[i-1]);
						
					//	}
					//	var room2 = {
					//			name : vms2.id + "-" + vfs2.id,
					//			male : vms2,
					//			female : vfs2
					//		};
					//	req.io.room(room.name).broadcast('previous',room2);
					//}
					//for location of smembers to check if user already chatted
					//client.smembers(room.name,function(err,result_query){
					//	console.log("Check if already exist!!");
					//	var display = result_query;
					//	console.log(display);
					//	if(display == ""){
					//		console.log("OOOOO Chat Game OOOOO");
					//		app.io.broadcast(vfs.id, room);
					//		app.io.broadcast(vms.id, room);
					//	}
					//});
					
					client.srem(room.name,JSON.stringify(room));
					client.sadd(room.name,JSON.stringify(room));
					//client.smembers(room.name,function(err,result_query){
					//	console.log("Inserted new room!!");
					//	var display2 = result_query;
					//	console.log(display2);
					//});
					
					rooms.push(room);
					console.log("=== Start Conversation ===");
					app.io.broadcast(vfs.id, room);
					app.io.broadcast(vms.id, room);
				}
				else{
					if(vf[i]){
						var vfs = JSON.parse(vf[i]);
						client.srem("visitor:female",vf[i]);
						app.io.broadcast(vfs.id, false);
						console.log("kickout: " + vfs.id);
					}
					if(vm[i]){
						var vms = JSON.parse(vm[i]);
						client.srem("visitor:male",vm[i]);
						console.log("kickout: " + vms.id);
						app.io.broadcast(vms.id, false);
					}
				}
			}
			for(var j=i;j<vm.length;j++){
				if(vf[i]){
					var vfs = JSON.parse(vf[i]);
					client.srem("visitor:female",vf[i]);
					app.io.broadcast(vfs.id, false);
					console.log("kickout: " + vfs.id);
				}
				if(vm[i]){
					var vms = JSON.parse(vm[i]);
					client.srem("visitor:female",vm[i]);
					console.log("kickout: " + vms.id);
					app.io.broadcast(vms.id, false);
				}
			}
			new_vm.push(vm[0]);
			setTimeout(function(){
				console.log("@@@@@CYCLE@@@@@");
				console.log(cycle);
				console.log(rooms.length);
				cycle = cycle + 1; //put after the if condition
				
				if(cycle < rooms.length){
					console.log("XXXX HERE IT GOES inside XXXX");
					cycle_turn = true;
					start_chat(vf,new_vm,cycle);
				}
				else{
					console.log("XXXX HERE IT GOES outside XXXX");
					rotationGame = rotationGame + 1;
					console.log("rotationGame");
					console.log(rotationGame);
					game_lock = false;
					newuser = false;
					app.io.broadcast('game_stop', true);
				}
			},15000);
		},
		
	},function(err,result){
		
	});
};

//Game chat arrange
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

app.listen(80);
