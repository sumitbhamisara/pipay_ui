var bucket = firebase.storage().ref();

var filesUploaded = 0;
var images = [];

document.querySelector("input[type=file]").addEventListener("change",(eve)=>{
    if(eve.target.files[0]){
        images.push(eve.target.files[0]);
        if(images.length == 5){
            document.querySelector("input[type=file]").disabled = true;
        }
        document.querySelector(".btn-danger").style.display = "block";
        var fReader = new FileReader();
        fReader.readAsDataURL(eve.target.files[0]);
        fReader.onload = function (frEvent) {
            document.querySelector(`img.image_${images.length}`).src = frEvent.target.result;
        };
        document.querySelector("input[type=file]").value="";
    }
});

document.querySelector(".btn-danger").addEventListener("click",()=>{
    for (let index = 1; index <= images.length; index++) {
        document.querySelector(`img.image_${index}`).src = "";
    }
    document.querySelector(".btn-danger").style.display = "none";
    images = [];
    document.querySelector("input[type=file]").disabled = false;
});

document.querySelector(".btn-info").addEventListener("click",()=>{
    var input = document.createElement('input');
    input.value = document.querySelector('#color').value;
    input.name = "color_"+(document.querySelector('.added-colors').children.length + 1);
    input.readOnly = true;
    document.querySelector('.added-colors').appendChild(input);
    document.querySelector('#color').value = "";
});

document.querySelector("form .btn-success").addEventListener("click",()=>{
    var allInputs = document.querySelectorAll("input");
    var isEmpty = false;
    allInputs.forEach((input)=>{
        if(input.value.length < 1){
            if(input.hidden == false && input.type != "file" && input.id != "color"){
                isEmpty = true;
            }
        }
    });
    if(isEmpty || document.querySelector("img.image_1").getAttribute("src") == ""){
        alert("all fields are required");
    }else{
        var notify = document.createElement("div");
        notify.className="notify";
        notify.innerHTML = `
        <h1>UPLOADING IMAGES</h1>
        </br>
        </br>
        </h2>DO NOT CLOSE THIS TAB</h2>
        `;
        document.body.appendChild(notify);
        //upload all images then send links to server
        var itemName = document.querySelector("input[name='name']").value;
        var no = 1;
        images.forEach((image)=>{
            uploadImage(image,itemName,no);
            no++;
        });
    }
});

function uploadImage(img,itemName,no){
    var imgRef = bucket.child(itemName+"/"+no);
    imgRef.put(img).then(async (snapshot) => {
        var downloadURL = await snapshot.ref.getDownloadURL();
        document.querySelector(`input[name='image_${no}']`).value = downloadURL;
        filesUploaded++;
        checkIfAllFilesUploaded();
    });
}

function checkIfAllFilesUploaded(){
    if(filesUploaded == images.length){
        document.querySelector("input[name='name']").value = document.querySelector("input[name='name']").value.trim();
        document.querySelector("form").submit();
    }
}