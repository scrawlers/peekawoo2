
$(function(){
	var socket = io.connect();
	var room = $("#room").val();
	socket.emit('join',{room:room});
	var user = $("#user").val();
	user = JSON.parse(user);
	var my_chatm8 = $("#chatm8").val();
	my_chatm8 = JSON.parse(my_chatm8);
	//alert(contval);
	var contmechatm8 = {};
	if(user.id == my_chatm8.male.id){
		$(".current-photo").html("<img class='cpimg' src='"+my_chatm8.female.photourl+"'></img>");
		contmechatm8 = {user: user,mate:my_chatm8.female};
	}
	else{
		$(".current-photo").html("<img class='cpimg' src='"+my_chatm8.male.photourl+"'></img>");
		contmechatm8 = {user: user,mate:my_chatm8.male};
	}
	
	//socket.emit('files',contmechatm8);	
	
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
	
	//socket.on('reveal',function(){
	//});
	
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
		window.location = '/loading';
	});
});
