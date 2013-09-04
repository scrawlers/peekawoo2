
$(function(){
	var socket = io.connect();
	var room = $("#room").val();
	socket.emit('join',{room:room});
	var user = $("#user").val();
	user = JSON.parse(user);
	var my_chatm8 = $("#chatm8").val();
	var list_gen = $("#list").val();
	list_gen = JSON.parse(list_gen);
	my_chatm8 = JSON.parse(my_chatm8);

	var contmechatm8 = {};
	if(user.id == my_chatm8.male.id){
		$(".current-photo").html("<img class='cpimg' src='"+my_chatm8.female.photourl+"'></img>");
		for(var i = 0; i<list_gen.length; i++){
			//list_gen[i] = JSON.parse(list_gen[i]);
			if(list_gen[i].id == my_chatm8.female.id){
				if(i===0){
					//list_gen[list_gen.length-1] = JSON.parse(list_gen[list_gen.length-1]);
					$(".previous-photo").html("<img class='ppimg' src='"+list_gen[list_gen.length-1].photourl+"'></img>");
				}
				else{
					//list_gen[i-1] = JSON.parse(list_gen[i-1]);
					$(".previous-photo").html("<img class='ppimg' src='"+list_gen[i-1].photourl+"'></img>");
				}
			}
		}
		contmechatm8 = {user: user,mate:my_chatm8.female};
	}
	else{
		$(".current-photo").html("<img class='cpimg' src='"+my_chatm8.male.photourl+"'></img>");
		for(var i = 0; i<list_gen.length; i++){
			//list_gen[i] = JSON.parse(list_gen[i]);
			if(list_gen[i].id == my_chatm8.male.id){
				if(i===0){
					//list_gen[list_gen.length-1] = JSON.parse(list_gen[list_gen.length-1]);
					$(".previous-photo").html("<img class='ppimg' src='"+list_gen[list_gen.length-1].photourl+"'></img>");
				}
				else{
					//list_gen[i-1] = JSON.parse(list_gen[i-1]);
					$(".previous-photo").html("<img class='ppimg' src='"+list_gen[i-1].photourl+"'></img>");
				}
			}
		}
		contmechatm8 = {user: user,mate:my_chatm8.male};
	}
	
	socket.on('roomtopic',function(data){
		$(".messagewindow").html("<p class='topic_per_room'><strong>TOPIC: "+data+"</strong></p>");
	});
	
	//alert(list_gen);
	//alert(list_gen[0]);
	//alert(list_gen[0].id);
	socket.on('previous',function(data){
		var chatmates = data;
		var chatid = {};
		if(user.gender == my_chatm8.male.gender){
			chatid = my_chatm8.female.id; 
		}
		else{
			chatid = my_chatm8.male.id;
		}
		for(var i = 0; i < chatmates.length; i++ ){
			if(chatid == chatmates[i].id){
				if(i === 0){
					alert("DULO");
					$(".previous-photo").html("<img class='ppimg' src='"+chatmates[chatmates.length].photourl+"'></img>");
				}
				else{
					alert("UNA");
					$(".previous-photo").html("<img class='ppimg' src='"+chatmates[i-1].photourl+"'></img>");
				}
				
			}
		}
	});	
	
	$('.ratings_chick').click(
		function(){
			if($(this).is('.ratings_chick')){
				socket.emit('uninsert',contmechatm8);
			}
			else{
				socket.emit('insert',contmechatm8);
			}
		}
	);

	socket.on(user.id,function(data){
		if(data){
			window.location = '/chat/'+data.name;
		}
		else{
			window.location = '/error';
		}
	});
	
	$("#signout").click(function(){
		//alert(roomsend);
		//socket.emit('leave',{user: user,room:room});
		socket.emit('leave',{user: user,room:my_chatm8});
	});
	
	socket.on('new msg',function(data){
		console.log("++++++++data++++++");
		console.log(data);
		if(data.gender == "male"){
			$(" .messagewindow").append("<img class='leftp'></img><img class='imgleft' src='"+data.photourl+"'></img><p class='me-chat'><strong>"+data.codename+":</strong> <em>"+data.msg+"</em></p>");
		}
		else{
			$(" .messagewindow").append("<img class='rightp'></img><img class='imgright' src='"+data.photourl+"'></img><p class='you-chat'><strong>"+data.codename+":</strong> <em>"+data.msg+"</em></p>");
		}
		$(".messagewindow").prop({scrollTop: $(".messagewindow").prop("scrollHeight")});
	});
	
	$("#reply").click(function(){
		var inputText = $("#message").val().trim();
		if(inputText){
			var chunks = inputText.match(/.{1,1234}/g)
			, len = chunks.length;
			for(var i = 0; i<len; i++){
				user.msg = chunks[i];
				if(user.provider=='twitter'){
					if(user.id==my_chatm8.male.id){
						user.gender = my_chatm8.male.gender;
					}
					else{
						user.gender = my_chatm8.female.gender;
					}
				}
				socket.emit('my msg',user);
			}
			$("#message").val('');
			
			return false;
		}
	});
	$("#message").keypress(function(e){
		var inputText = $(this).val().trim();
		if(e.which == 13 && inputText){
			var chunks = inputText.match(/.{1,1024}/g)
				, len = chunks.length;
			
			for(var i=0; i<len; i++) {
				user.msg = chunks[i];
				socket.emit('my msg',user);
				//socket.emit('my msg', {
					//msg: chuncks[i]
				//});
			}
			$(this).val('');
			return false;
		}
	});
	socket.on('game_stop',function(){
		console.log("XXXX GO BACK TO LOADING XXXX");
		window.location = '/loading';
	});
});
