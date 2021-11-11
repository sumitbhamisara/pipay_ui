for (let index = 0; index < kycForms.length; index++){

    var application = kycForms[index];

    var div = document.createElement("div");
    div.className="request";

    div.innerHTML = 
    `
    <div>
        <b>USERNAME: </b><span>${application.username}</span>
    </div>
    <div>
        <b>Submitted On: </b>${application.date}
    </div>
    <div>
        <b>Status:</b> <span class="status">${application.status}</span>
    </div>
    <a href="/adminKYCS/${application.username}"/>
        <div class="btn btn-success">View</div>
    </a>
    `;

    document.querySelector("."+application.status).appendChild(div);
}
