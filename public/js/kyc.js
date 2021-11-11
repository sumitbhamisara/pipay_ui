var bucket = firebase.storage().ref();

var allImgInputs = document.querySelectorAll("input[type='file'");

if(status == "null"){
    document.querySelector(".btn-info").addEventListener("click",()=>{
        var allInputs = document.querySelectorAll("input");
        var isEmpty = false;
        allInputs.forEach((input)=>{
            if(input.value.length < 1){
                if(input.hidden == false){
                    isEmpty = true;
                }
            }
        });
        if(isEmpty){
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
            allImgInputs.forEach((imageInput)=>{
                uploadImage(imageInput.files[0],imageInput);
            });
        }
    });
}

var filesUploaded = 0;

function checkIfAllFilesUploaded(){
    if(filesUploaded == allImgInputs.length){
        document.querySelector("form").submit();
        setTimeout(() => {
            location.reload();
        },1000);
    }
}

function uploadImage(img,elem){
    var imgRef = bucket.child(thisUser+"/"+elem.className);
    imgRef.put(img).then(async (snapshot) => {
        var downloadURL = await snapshot.ref.getDownloadURL();
        document.querySelector(`input[name='${elem.className}']`).value = downloadURL;
        filesUploaded++;
        checkIfAllFilesUploaded();
    });
}

allImgInputs.forEach((imgInput)=>{
    imgInput.addEventListener("change",(eve)=>{
        if(eve.target.files[0]){
            var fReader = new FileReader();
            fReader.readAsDataURL(eve.target.files[0]);
            fReader.onload = function (frEvent) {
                document.querySelector(`img.${eve.target.className}`).src = frEvent.target.result;
            };
        }
    });
})
