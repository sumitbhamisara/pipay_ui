document.querySelector(".add-new").addEventListener("click",()=>{
    if( document.querySelector(".add-new").innerText == "Add New"){

        //clear fields
        document.querySelector("#address").value = "";
        document.querySelector("#city").value = "";
        document.querySelector("#pin_code").value = "";

        document.querySelector(".add-new-holder").style.display = "flex";
        document.querySelector(".add-new").innerText = "Submit";
    }else{
        if(!(document.querySelector("#address").value.trim() == "" || document.querySelector("#city").value.trim() == "" || document.querySelector("#pin_code").value.trim() == "")){
            document.querySelector(".add-new-holder").style.display = "none";
            document.querySelector(".add-new").innerText = "Add New";
    
            var holder = document.createElement("div");
            var number = document.querySelector(".addresses-holder").childElementCount + 1;
            holder.className = "address-"+number;
            holder.innerHTML = 
            `
            <input type="radio" name="radio-address" id="address-${number}">
            <div class="address-inner">
            <div class="address">
                ${document.querySelector("#address").value}           
            </div>
            <div>
                city:
                <span class="city"> ${document.querySelector("#city").value}</span>
            </div>
            <div>
                Pin Code: 
                <span class="pin_code">${document.querySelector("#pin_code").value}</span>
            </div>
            </div>
            
            `
            
            document.querySelector(".addresses-holder").appendChild(holder);
            
            var checkedRadio = document.querySelectorAll("input:checked");
            if(checkedRadio){
                checkedRadio.checked = false;
            }
                        
            document.querySelector("#address-"+number).checked = true;
    
        }else{
            alert("all fields are required")
        }
    }
});


document.querySelector(".proceed-to-pay").addEventListener("click",()=>{
    var allRadios = document.querySelectorAll("input[type=radio]");

    var matched = false;

    allRadios.forEach((button)=>{
        if(button.checked && button.disabled == false){
            matched = true;
            document.querySelector("input[name='address']").value  = document.querySelector(`.${button.id} .address`).innerText;
            document.querySelector("input[name='city']").value     = document.querySelector(`.${button.id} .city`).innerText;
            document.querySelector("input[name='pin_code']").value = document.querySelector(`.${button.id} .pin_code`).innerText;
        }
    });

    if(matched){
        document.querySelector(".address-select").style.display = "none";
        document.querySelector(".pay").style.display = "flex";
        document.querySelector("input:disabled").disabled = false;

        if(balance < price){
            var insufficientFundsHolder = document.createElement("h3");
            insufficientFundsHolder.innerText = "insufficient balance";
            document.querySelector(".confirm-holder").prepend(insufficientFundsHolder);

            document.querySelector(".confirm").innerText = "Add Funds";
        }
        //check if user has sufficent funds
    }else{
        alert("please select an address");
    }

});


document.querySelector(".confirm").addEventListener("click",()=>{
    document.querySelector("form").submit();
});