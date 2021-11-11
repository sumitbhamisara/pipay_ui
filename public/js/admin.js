for (let index = 0; index < users.length; index++){

    var user = users[index];

    if(user.username == thisUser){
        continue;
    }

    var status = "active";

    if(user.isAdmin){
        status = "admin"
    }else if(user.isBlocked){
        status = "blocked"
    }

    var div = document.createElement("div");
    div.innerHTML = 
    `
    <a href="/admin/user/${user.username}">
        <span>${user.username}</span>
    </a>
    <span>${user.balance}</span>
    <span style="color:${status == "active" ? "green" : status == "blocked" ? "red" : "#f0ad4e" }" >${status}</span>
    `;

    var actionsHolder = document.createElement("span");
    actionsHolder.classList.add("actions-holder");


    var blockButton = document.createElement("div");
    blockButton.classList.add("btn");
    blockButton.classList.add("btn-warning");
    blockButton.classList.add("btn-sm");
    blockButton.innerText = "block";
    if(user.isAdmin){
        blockButton.classList.add("disabled");
    }
    if(user.isBlocked){
        blockButton.innerText = "Un Block";
    }

    if(user.isBlocked){
        blockButton.onclick = (function(blockedUser,button){
            return function() {
                doPost(blockedUser,"unblock");
                button.innerText = "UNBLOCKED";
                button.classList.add("disabled");
                button.classList.add("success");
                button.classList.remove("warning");
                setTimeout(() => {
                    location.reload();
                },500);
            };
        })(user.username,blockButton);
    }else if(!user.isAdmin){
        blockButton.onclick = (function(blockedUser,button){
            return function() {
                doPost(blockedUser,"block");
                button.innerText = "BLOCKED";
                button.classList.add("disabled");
                button.classList.add("success");
                button.classList.remove("warning");
                setTimeout(() => {
                    location.reload();
                },500);
            };
        })(user.username,blockButton);
    }

    actionsHolder.appendChild(blockButton);

    var makeAdminButton = document.createElement("div");
    makeAdminButton.classList.add("btn");
    makeAdminButton.classList.add("btn-danger");
    makeAdminButton.innerText = "Make Admin";
    if(user.isBlocked || user.isAdmin){
        makeAdminButton.classList.add("disabled");
    }

    makeAdminButton.onclick = (function(addedAdmin,button){  
        return function() {
            doPost(addedAdmin,"addadmin");
            button.innerText = "ADDED ADMIN";
            button.classList.add("disabled");
            button.classList.add("success");
            button.classList.remove("danger");
            setTimeout(() => {
                location.reload();
            },500);
        };
    })(user.username,makeAdminButton);
    actionsHolder.appendChild(makeAdminButton);

    div.appendChild(actionsHolder);
    document.querySelector(".table-section").appendChild(div);
}

function doPost(username,action){
    axios.post("/admin",{
        username:username,
        action:action
    });
}
