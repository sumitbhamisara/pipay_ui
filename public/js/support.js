var socket = io();

socket.emit('join room',username);

document.querySelector(".fa-paper-plane").addEventListener("click",function(){
    if(document.querySelector("textarea").value){

        var msg = {
            message: document.querySelector("textarea").value,
            username: username,
            fromAdmin: isAdmin
        }

        socket.emit("new message",msg);

        document.querySelector("textarea").value = "";
    }
});

socket.emit("mark seen",{username: username, isAdmin: isAdmin});

socket.on('new message',(message)=>{
    var div = document.createElement('div');
    div.innerText = message.message;
    div.classList.add('message');

    if(message.fromAdmin && isAdmin){
        div.classList.add('self');
    }else if(!message.fromAdmin && !isAdmin){
        div.classList.add('self');
    }

    socket.emit("mark seen",{username: username, isAdmin: isAdmin});

    document.querySelector('.messages').appendChild(div);

    scrollToBottom();
});

function scrollToBottom(){
    if(document.querySelector(".messages")){
      document.querySelector(".messages").scrollTop = document.querySelector(".messages").scrollHeight;
    }
}

scrollToBottom();