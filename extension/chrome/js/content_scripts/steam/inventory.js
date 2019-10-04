// sends a message to the "back end" to request inventory contents
function requestInventory(){
    chrome.runtime.sendMessage({inventory: getInventoryOwnerID()}, (response) => {
        if (!(response === undefined || response.inventory === undefined || response.inventory === '' || response.inventory === 'error')){
            items = response.inventory;
            addElements();
            addPerItemInfo();
            setInventoryTotal(items);
            addFunctionBar();
            loadFullInventory();
            addPageControlEventListeners('inventory');
        }
        else{
            console.log("Wasn't able to get the inventory, it's most likely steam not working properly or you loading inventory pages at the same time");
            console.log("Retrying in 30 seconds");
            setTimeout(() => {requestInventory()}, 30000);
        }
    });
}

//adds everything that is per item, like trade lock, exterior, doppler phases, border colors
function addPerItemInfo(updating){
    // moves the nametag warning icon to make space for other elements
    document.querySelectorAll('.slot_app_fraudwarning').forEach(fraudwarning => {fraudwarning.setAttribute('style', `${fraudwarning.getAttribute('style')}; top: 19px; left: 75px;`)});

    let itemElements = document.querySelectorAll('.item.app730.context2');
    if (itemElements.length !== 0){
        chrome.storage.local.get('colorfulItems', (result) => {
            itemElements.forEach(itemElement =>{
                if (itemElement.getAttribute('data-processed') === null || itemElement.getAttribute('data-processed') === 'false'){
                    // in case the inventory is not loaded yet it retries in a second
                    if (itemElement.id === undefined) {
                        setTimeout( () =>{addPerItemInfo(false)}, 1000);
                        return false
                    }
                    else{
                        let item = getItemByAssetID(items, getAssetIDOfElement(itemElement));

                        if (updating){
                            let itemDateElement = itemElement.querySelector('.perItemDate');
                            if (itemDateElement !== null){
                                itemDateElement.innerText =  getShortDate(item.tradability);
                                itemDateElement.classList.toggle('not_tradable');
                                itemDateElement.classList.toggle('tradable');
                            }
                        }
                        else{
                            // adds tradability indicator
                            if (item.tradability === 'Tradable') itemElement.insertAdjacentHTML('beforeend', `<div class="perItemDate tradable">T</div>`);
                            else if (item.tradability !== 'Not Tradable')  itemElement.insertAdjacentHTML('beforeend', `<div class="perItemDate not_tradable">${item.tradabilityShort}</div>`);

                            addDopplerPhase(itemElement, item.dopplerInfo);
                            makeItemColorful(itemElement, item, result.colorfulItems);
                            addSSTandExtIndicators(itemElement, item);
                            addPriceIndicator(itemElement, item.price);
                            addFloatIndicator(itemElement, item.floatInfo);

                            // marks the item "processed" to avoid additional unnecessary work later
                            itemElement.setAttribute('data-processed', 'true');
                        }
                    }
                }
            });
        });
    }
    // in case the inventory is not loaded yet
    else{setTimeout( () => {addPerItemInfo(false)}, 1000)}
}

function addElements(){
    // only add elements if the CS:GO inventory is the active one
    if(isCSGOInventoryActive('inventory')){
        let activeID = undefined;
        try {activeID = getAssetIDofActive()}
        catch (e) { console.log("Could not get assetID of active item"); return false}
        let item = getItemByAssetID(items, activeID);

        // removes "tags" and "tradable after" in one's own inventory
        document.querySelectorAll("#iteminfo1_item_tags, #iteminfo0_item_tags, #iteminfo1_item_owner_descriptors, #iteminfo0_item_owner_descriptors").forEach((tagsElement) => tagsElement.parentNode.removeChild(tagsElement));

        // cleans up previously added elements
        cleanUpElements(false);

        // removes previously added listeners
        document.querySelectorAll(".showTechnical, .lowerModule").forEach(element => element.removeEventListener('click'));

        // adds float bar, sticker info, nametag
        document.querySelectorAll(".item_desc_icon").forEach((icon) =>{icon.insertAdjacentHTML("afterend", upperModule)});

        // listens to click on "show technical"
        document.querySelectorAll(".showTechnical").forEach(showTechnical => {
            showTechnical.addEventListener("click", () =>{
                document.querySelectorAll(".floatTechnical").forEach(floatTechnical => floatTechnical.classList.toggle("hidden"));
            })
        });

        // allows the float pointer's text to go outside the boundaries of the item - they would not be visible otherwise on high-float items
        // also removes background from the right side of the page
        document.querySelectorAll(".item_desc_content").forEach((item_desc_content) => item_desc_content.setAttribute("style", "overflow: visible; background-image: url()"));

        // adds the lower module that includes tradability, countdown  and bookmarking
        document.querySelectorAll("#iteminfo1_item_actions, #iteminfo0_item_actions").forEach((action) => action.insertAdjacentHTML("afterend", lowerModule));

        document.querySelectorAll('.lowerModule').forEach(module => {
            module.addEventListener('click', event => {addBookmark(event.target)})
        });

        if(item){
            // adds the nametag text to nametags
            document.querySelectorAll(".nametag").forEach((nametag) =>{
                if(item.nametag !== undefined){
                    nametag.innerText = item.nametag;
                    document.querySelectorAll(".fraud_warning").forEach((fraud_warning) => fraud_warning.outerHTML = "");
                }
                else{
                    nametag.style.display = "none";
                }
            });

            // repositions stickers
            if(item.stickers.length !== 0){
                // removes the original stickers elements
                let originalStickers = document.getElementById("sticker_info");
                if(originalStickers !== null) originalStickers.outerHTML = "";

                // sometimes it is added slowly so it does not get removed the first time..
                setTimeout(() =>{if(originalStickers !== null && originalStickers.parentNode !== null) originalStickers.outerHTML = ""}, 1000);

                // adds own sticker elements
                item.stickers.forEach((stickerInfo) =>{
                    document.querySelectorAll(".customStickers").forEach((customStickers) =>{
                        customStickers.innerHTML = customStickers.innerHTML + `
                        <div class="stickerSlot" data-tooltip="${stickerInfo.name}">
                            <a href="${stickerInfo.marketURL}" target="_blank">
                                <img src="${stickerInfo.iconURL}" class="stickerIcon">
                            </a>
                        </div>
                        `
                    });
                })
            }

            // adds duplicates counts
            document.querySelectorAll(".duplicate").forEach (duplicate => {
                duplicate.style.display = "block";
                duplicate.innerText = "x" + item.duplicates.num;
            });

            // sets the tradability info
            document.querySelectorAll(".tradabilityDiv").forEach (tradabilityDiv => {
                if(item.tradability === "Tradable"){
                    tradabilityDiv.innerHTML = tradable;
                    document.querySelectorAll(".countdown").forEach((countdown) => countdown.style.display = "none");
                }
                else if(item.tradability === "Not Tradable"){
                    tradabilityDiv.innerHTML = notTradable;
                    document.querySelectorAll(".countdown").forEach((countdown) => countdown.style.display = "none");
                }
                else{
                    let tradableAt = new Date(item.tradability).toString().split("GMT")[0];
                    tradabilityDiv.innerHTML = `<span class='not_tradable'>Tradable After ${tradableAt}</span>`;
                    countDown(tradableAt);
                    document.querySelectorAll(".countdown").forEach((countdown) => countdown.style.display = "block");
                }
            });


            // adds doppler phase  to the name and makes it a link to the market listings page
            let name = item.name;

            getInventory().then(inventory => {
                inventory.inventory.forEach((onPageItem) => {if(onPageItem.assetid === activeID) name = onPageItem.description.name});
                changeName(name, item.name_color, item.marketlink, item.dopplerInfo);
            });

            // removes sih "Get Float" button - does not really work since it's loaded after this script..
            if(isSIHActive()){
                document.querySelectorAll(".float_block").forEach(e => e.parentNode.removeChild(e));
                setTimeout(() =>{document.querySelectorAll(".float_block").forEach(e => e.parentNode.removeChild(e));}, 1000);
            }
            if (item.floatInfo === null){
                if (item.inspectLink !== null && item.type !== itemTypes.collectible && item.type !== itemTypes.container && item.type !== itemTypes.graffiti && item.type !== itemTypes.c4 && item.type !== itemTypes.sticker) {
                    floatQueue.jobs.push({
                        type: 'inventory_floatbar',
                        assetID: item.assetid,
                        inspectLink: item.inspectLink
                    });
                    workOnFloatQueue();
                }
                else hideFloatBars();
            }
            else {
                updateFloatAndPatternElements(item);
                addFloatIndicator(findElementByAssetID(item.assetid), item.floatInfo);
            }

            // it takes the visible descriptors and checks if the collection includes souvenirs
            let textOfDescriptors = '';
            document.querySelectorAll('.descriptor').forEach(descriptor => {
                if(descriptor.parentNode.classList.contains('item_desc_descriptors') && descriptor.parentNode.parentNode.parentNode.parentNode.style.display !== 'none'){
                    textOfDescriptors += descriptor.innerText;
                }

            });
            let thereSouvenirForThisItem =  souvenirExists(textOfDescriptors);

            let genericMarketLink = 'https://steamcommunity.com/market/listings/730/';
            let weaponName = '';
            let stattrak = 'StatTrak%E2%84%A2%20';
            let stattrakPretty = 'StatTrak™';
            let souvenir = 'Souvenir ';
            let star = item.starInName ? '%E2%98%85%20' : '';

            if (item.isStatrack) weaponName = item.market_hash_name.split('StatTrak™ ')[1].split('(')[0];
            else if (item.isSouvenir) weaponName = item.market_hash_name.split('Souvenir ')[1].split('(')[0];
            else{
                weaponName = item.market_hash_name.split('(')[0].split('★ ')[1];
                if (weaponName === undefined) weaponName = item.market_hash_name.split('(')[0];
            }

            let stOrSv = stattrakPretty;
            let stOrSvClass = 'stattrakOrange';
            let linkMidPart = star + stattrak;
            if (item.isSouvenir || thereSouvenirForThisItem){
                stOrSvClass = 'souvenirYellow';
                stOrSv = souvenir;
                linkMidPart = souvenir;
            }

            let otherExteriors = `
            <div class="descriptor otherExteriors">
                <span>${chrome.i18n.getMessage("links_to_other_exteriors")}:</span>
                <ul>
                    <li><a href="${genericMarketLink + star + weaponName + "%28Factory%20New%29"}" target="_blank">${exteriors.factory_new.localized_name}</a> - <a href="${genericMarketLink + linkMidPart + weaponName}%28Factory%20New%29" target="_blank"><span class="${stOrSvClass} exteriorsLink">${stOrSv} ${exteriors.factory_new.localized_name}</span></a></li>
                    <li><a href="${genericMarketLink + star + weaponName + "%28Minimal%20Wear%29"}"" target="_blank">${exteriors.minimal_wear.localized_name}</a> - <a href="${genericMarketLink + linkMidPart + weaponName}%28Minimal%20Wear%29" target="_blank"><span class="${stOrSvClass} exteriorsLink">${stOrSv} ${exteriors.minimal_wear.localized_name}</span></a></li>
                    <li><a href="${genericMarketLink + star + weaponName + "%28Field-Tested%29"}"" target="_blank">${exteriors.field_tested.localized_name}</a> - <a href="${genericMarketLink + linkMidPart + weaponName}%28Field-Tested%29" target="_blank"><span class="${stOrSvClass} exteriorsLink">${stOrSv} ${exteriors.field_tested.localized_name}</span></a></li>
                    <li><a href="${genericMarketLink + star + weaponName + "%28Well-Worn%29"}"" target="_blank">${exteriors.well_worn.localized_name}</a> - <a href="${genericMarketLink + linkMidPart + weaponName}%28Well-Worn%29" target="_blank"><span class="${stOrSvClass} exteriorsLink">${stOrSv} ${exteriors.well_worn.localized_name}</span></a></li>
                    <li><a href="${genericMarketLink + star + weaponName + "%28Battle-Scarred%29"}"" target="_blank">${exteriors.battle_scarred.localized_name}</a> - <a href="${genericMarketLink + linkMidPart + weaponName}%28Battle-Scarred%29" target="_blank"><span class="${stOrSvClass} exteriorsLink">${stOrSv} ${exteriors.battle_scarred.localized_name}</span></a></li>
                </ul>
                <span>${chrome.i18n.getMessage("not_every_available")}</span>
            </div>
            `;

            if(item.exterior !== undefined) document.querySelectorAll('#iteminfo1_item_descriptors, #iteminfo0_item_descriptors').forEach((descriptor) => descriptor.insertAdjacentHTML('afterend', otherExteriors));
        }
    }
    else document.querySelectorAll('.countdown').forEach((countdown) => countdown.style.display = 'none');
}

function cleanUpElements(nonCSGOInventory) {
    document.querySelectorAll('.upperModule, .lowerModule, .otherExteriors, .custom_name').forEach((element) => element.parentNode.removeChild(element));
    if (nonCSGOInventory) document.querySelectorAll('.hover_item_name').forEach((name) => name.classList.remove('hidden'));
}

// gets the asset id of the item that is currently selected
function getAssetIDofActive() {return getAssetIDOfElement(document.querySelector('.activeInfo'))}

function countDown(dateToCountDownTo){
    if(!countingDown){
        countingDown = true;
        countDownID = setInterval(() =>{
            document.querySelectorAll(".countdown").forEach((countdown) => {
                let now = new Date().getTime();
                let distance = new Date(dateToCountDownTo) - now;
                let days = Math.floor(distance / (1000 * 60 * 60 * 24));
                let hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                let minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                let seconds = Math.floor((distance % (1000 * 60)) / 1000);

                countdown.innerText = `${days}d ${hours}h ${minutes}m ${seconds}s remains`;

                if (distance < 0) {
                    clearInterval(countDownID);
                    countdown.classList.add('hidden');
                    document.querySelectorAll('.tradabilityDiv').forEach (tradabilityDiv => {
                        tradabilityDiv.innerText = 'Tradable';
                        tradabilityDiv.classList.add('tradable');
                    });

                }
            });
        }, 1000);
    }
    else{
        clearInterval(countDownID);
        countingDown = false;
        countDown(dateToCountDownTo);
    }
}

// it hides the original item name element and replaces it with one that is a link to it's market page and adds the doppler phase to the name
function changeName(name, color, link, dopplerInfo){
    let newNameElement = `<a class="hover_item_name custom_name" style="color: #${color}" href="${link}" target="_blank">${name}</a>`;

    if(dopplerInfo !== undefined) newNameElement = `<a class="hover_item_name custom_name" style="color: #${color}" href="${link}" target="_blank">${name} (${dopplerInfo.name})</a>`;

    document.querySelectorAll(".hover_item_name").forEach((name) => {
        name.insertAdjacentHTML("afterend", newNameElement);
        name.classList.add("hidden");
    });
}

function addBookmark(module) {
    let item = getItemByAssetID(items, getAssetIDofActive());
    let bookmark = {
        itemInfo: item,
        owner: getInventoryOwnerID(),
        comment: ' ',
        notify: true,
        notifTime: item.tradability.toString(),
        notifType: 'chrome'
    };

    chrome.storage.local.get('bookmarks', (result) => {
        let bookmarks = result.bookmarks;
        bookmarks.push(bookmark);

        chrome.storage.local.set({'bookmarks': bookmarks}, () => {
            if (bookmark.itemInfo.tradability !== 'Tradable') chrome.runtime.sendMessage({setAlarm: {name:  bookmark.itemInfo.assetid, when: bookmark.itemInfo.tradability}}, (response) => {});

            chrome.runtime.sendMessage({openInternalPage: '/html/bookmarks.html'}, (response) => {
                if (response.openInternalPage === 'no_tabs_api_access') module.querySelector('.descriptor.tradability.bookmark').innerText = 'Bookmarked! Open the bookmarks menu to see what you have saved!';
            });
        });
    });
}

function hideOtherExtensionPrices(){
    // sih
    if (!document.hidden && isSIHActive()) document.querySelectorAll(".price_flag").forEach((price) => {price.remove()});
    setTimeout(() =>{hideOtherExtensionPrices()}, 2000);
}

function setInventoryTotal(items){
    let inventoryTotalValueElement = document.getElementById('inventoryTotalValue');
    chrome.runtime.sendMessage({inventoryTotal: items}, (response) => {
        if (!(response === undefined || response.inventoryTotal === undefined || response.inventoryTotal === '' || response.inventoryTotal === 'error' || inventoryTotalValueElement === null)){
            inventoryTotalValueElement.innerText = response.inventoryTotal;
        }
        else setTimeout(() => {setInventoryTotal(items)}, 1000)
    });
}

function addFunctionBar(){
    if(document.getElementById("inventory_function_bar") === null){
        let hand_pointer = chrome.runtime.getURL("images/hand-pointer-solid.svg");
        let table = chrome.runtime.getURL("images/table-solid.svg");
        document.querySelector(".filter_ctn.inventory_filters").insertAdjacentHTML('afterend', `
                <div id="inventory_function_bar">
                    <div id="functionBarValues" class="functionBarRow">
                        <span id="selectedTotal"><span>Selected Items Value: </span><span id="selectedTotalValue">0.00</span></span>
                        <span id="inventoryTotal"><span>Total Inventory Value: </span><span id="inventoryTotalValue">0.00</span></span>
                    </div>
                    <div id="functionBarActions" class="functionBarRow">
                        <span id="selectMenu">
                            <img id ="selectButton" src="${hand_pointer}">
                        </span>
                        <span id="generate_menu">
                            <img id ="generate_list" src="${table}">
                        </span>
                        <div id="sortingMenu">
                            <span>Sorting:</span>
                            <select id="sortingMethod">
                            </select>
                        </div>
                    </div>
                    <div id="functionBarGenerateMenu" class="functionBarRow hidden">
                        <div>
                            <span>Generate list of inventory items (for posting in groups, trading forums, etc.) </span>
                            <span id="generate_button">Click here to generate</span> 
                        </div>
                            
                            <div id="generate_options">
                                <span>Delimiter</span>
                                <input id="generate_delimiter" value="-">
                                <span>Exterior:</span>
                                <select id="generate_exterior">
                                    <option value="full">Full length</option>
                                    <option value="short">Shortened</option>
                                </select>
                                
                                <span><b>Show:</b> Price</span>
                                <input type="checkbox" id="generate_price">
                                <span> Tradability</span>
                                <input type="checkbox" id="generate_tradability">
                                <span><b>Include:</b> Duplicates</span>
                                <input id="generate_duplicates" type="checkbox">
                                <span>Non-Marketable</span>
                                <input id="generate_non_market" type="checkbox">
                            </div>
                            
                            <div>
                                <b>Sort:</b>
                                <select id="generate_sort"></select>
                                <b>Limit result to:</b>
                                <input id="generate_limit" type="number" value="10000" min="1" max="10000">
                            </div>
                            <div>
                                <span id="generation_result"></span>
                                <a class="hidden" id="generate_download" href="" download="inventory_items.csv">Download .csv</a> 
                            </div>
                            <textarea class="hidden-copy-textarea" id="generated_list_copy_textarea"></textarea>
                    </div>
                </div>
                `);

        let sortingSelect = document.getElementById('sortingMethod');
        let generateSortingSelect = document.getElementById('generate_sort');

        let keys = Object.keys(sortingModes);
        for (let key of keys){
            let option = document.createElement("option");
            option.value = sortingModes[key].key;
            option.text = sortingModes[key].name;
            sortingSelect.add(option);
            generateSortingSelect.add(option.cloneNode(true));
        }

        document.getElementById("selectButton").addEventListener("click", (event) => {
            if(event.target.classList.contains("selectionActive")){
                unselectAllItems();
                updateSelectedValue();
                event.target.classList.remove("selectionActive");
                document.body.removeEventListener('click', listenSelectClicks, false);
            }
            else{
                document.body.addEventListener('click', listenSelectClicks, false);
                event.target.classList.add("selectionActive");
            }
        });

        sortingSelect.addEventListener("change", () => {
            let selected = sortingSelect.options[sortingSelect.selectedIndex].value;
            sortItems(items, selected);
        });

        document.getElementById('generate_list').addEventListener('click', () => {document.getElementById('functionBarGenerateMenu').classList.toggle('hidden')});

        document.getElementById('generate_button').addEventListener('click', generateItemsList);
    }
    else setTimeout(() => {setInventoryTotal(items)}, 1000);
}

function updateSelectedValue(){
    let selectedItems = document.querySelectorAll('.item.app730.context2.selected');
    let selectedTotal = 0;

    selectedItems.forEach(itemElement =>{
        let item = getItemByAssetID(items, getAssetIDOfElement(itemElement));
        selectedTotal += parseFloat(item.price.price);
    });

    chrome.storage.local.get('currency', (result) =>{
        document.getElementById('selectedTotalValue').innerText = prettyPrintPrice(result.currency, selectedTotal);
    });
}

function unselectAllItems() {document.querySelectorAll('.item.app730.context2').forEach(item => {item.classList.remove('selected')})}

function sortItems(items, method) {
    if (isCSGOInventoryActive('inventory')){
        let itemElements = document.querySelectorAll('.item.app730.context2');
        let inventoryPages = document.getElementById('inventories').querySelectorAll('.inventory_page');
        doTheSorting(items, Array.from(itemElements), method, Array.from(inventoryPages), 'inventory');
        addPerItemInfo(false);
    }
}

function loadFullInventory() {
    if (!isSIHActive()){
        let loadFullInventory = `
        g_ActiveInventory.LoadCompleteInventory().done(function () {
            for (let i = 0; i < g_ActiveInventory.m_cPages; i++) {
                g_ActiveInventory.m_rgPages[i].EnsurePageItemsCreated();
                g_ActiveInventory.PreloadPageImages(i);
            }
            window.postMessage({
                type: 'allItemsLoaded',
                allItemsLoaded: true
            }, '*');
        });`;
        injectToPage(loadFullInventory, true, 'loadFullInventory');
    }
    else doInitSorting();
}

function doInitSorting() {
    chrome.storage.local.get('inventorySortingMode', (result) => {
        sortItems(items, result.inventorySortingMode);
        document.querySelector(`#sortingMethod [value="${result.inventorySortingMode}"]`).selected = true;
        document.querySelector(`#generate_sort [value="${result.inventorySortingMode}"]`).selected = true;
        addFloatIndicatorsToPage(getActivePage('inventory'));
    });
}

function generateItemsList(){
    let generateSorting = document.getElementById('generate_sort');
    let sortingMode = generateSorting.options[generateSorting.selectedIndex].value;
    let sortedItems = doTheSorting(items, Array.from(document.querySelectorAll('.item.app730.context2')), sortingMode, null, 'simple_sort');
    let copyTextArea = document.getElementById('generated_list_copy_textarea');
    copyTextArea.value = '';

    let delimiter = document.getElementById('generate_delimiter').value;

    let limit = document.getElementById('generate_limit').value;

    let exteriorSelect = document.getElementById('generate_exterior');
    let exteriorSelected = exteriorSelect.options[exteriorSelect.selectedIndex].value;
    let exteriorType = exteriorSelected === 'full' ? 'name' : 'short';

    let showPrice = document.getElementById('generate_price').checked;
    let showTradability = document.getElementById('generate_tradability').checked;
    let includeDupes = document.getElementById('generate_duplicates').checked;
    let includeNonMarketable = document.getElementById('generate_non_market').checked;

    let lineCount = 0;
    let characterCount = 0;
    let namesAlreadyInList = [];

    let csvContent = 'data:text/csv;charset=utf-8,';
    let headers = `Name,Exterior${showPrice ? ',Price' : ''}${showTradability ? ',Tradability' : ''}${includeDupes ? '' : ',Duplicates'}\n`;
    csvContent += headers;

    sortedItems.forEach(itemElement => {
        let item = getItemByAssetID(items, getAssetIDOfElement(itemElement));
        let price = (showPrice && item.price !== null) ? ` ${delimiter} ${item.price.display}` : '';
        let priceCSV = (showPrice && item.price !== null) ? `,${item.price.display}` : '';
        let exterior = item.exterior !== undefined ? item.exterior[exteriorType] : '';
        let tradableAt = new Date(item.tradability).toString().split('GMT')[0];
        let tradability = (showTradability && tradableAt !== 'Invalid Date') ? `${delimiter} ${tradableAt}` : '';
        let tradabilityCSV = (showTradability && tradableAt !== 'Invalid Date') ? `,${tradableAt}` : '';
        let duplicate = (!includeDupes && item.duplicates.num !== 1) ? `${delimiter} x${item.duplicates.num}` : '';
        let duplicateCSV = (!includeDupes && item.duplicates.num !== 1) ? `,x${item.duplicates.num}` : '';
        let line = `${item.name} ${delimiter} ${exterior}${price}${tradability} ${duplicate}\n`;
        let lineCSV = `"${item.name}",${exterior}${priceCSV}${tradabilityCSV}${duplicateCSV}\n`;

        if(lineCount < limit){
            if (includeDupes || (!includeDupes && !namesAlreadyInList.includes(item.market_hash_name))){
                if ((!includeNonMarketable && item.tradability !== 'Not Tradable') || (item.tradability === 'Not Tradable' && includeNonMarketable)){
                    namesAlreadyInList.push(item.market_hash_name);
                    copyTextArea.value += line;
                    csvContent += lineCSV;
                    characterCount += line.length;
                    lineCount++;
                }
            }
        }
    });
    let encodedURI = encodeURI(csvContent);
    let downloadButton = document.getElementById('generate_download');
    downloadButton.setAttribute('href', encodedURI);
    downloadButton.classList.remove('hidden');
    downloadButton.setAttribute('download', `${getInventoryOwnerID()}_csgo_items.csv`);

    copyTextArea.select();
    document.execCommand('copy');

    document.getElementById('generation_result').innerText = `${lineCount} lines (${characterCount} chars) generated and copied to clipboard`;
}

function setFloatBarWithData(floatInfo){
    let floatTechnicalElement = getDataFilledFloatTechnical(floatInfo);

    document.querySelectorAll('.floatTechnical').forEach (floatTechnical => floatTechnical.innerHTML = floatTechnicalElement);

    let position = floatInfo.floatvalue.toFixed(2)*100-2;
    document.querySelectorAll('.floatToolTip').forEach(floatToolTip => floatToolTip.setAttribute('style', `left: ${position}%`));
    document.querySelectorAll('.floatDropTarget').forEach(floatDropTarget => floatDropTarget.innerText = floatInfo.floatvalue.toFixed(4));
}

function setPatternInfo(patternInfo){
    document.querySelectorAll('.patternInfo').forEach(patternInfoElement => {
        if(patternInfo !== null){
            if(patternInfo.type === 'fade'){
                patternInfoElement.classList.add('fadeGradient');
            }
            else if(patternInfo.type === 'marble_fade'){
                patternInfoElement.classList.add('marbleFadeGradient');
            }
            else if(patternInfo.type === 'case_hardened'){
                patternInfoElement.classList.add('caseHardenedGradient');
            }
            patternInfoElement.innerText = `Pattern: ${patternInfo.value}`;
        }
    });
}

// sticker wear to sticker icon tooltip
function setStickerInfo(stickers){
    if (stickers !== null) {
        stickers.forEach((stickerInfo, index) =>{
            let wear = 100;
            if(stickerInfo.wear !== undefined){
                wear =  Math.trunc(Math.abs( 1 - stickerInfo.wear) * 100);
            }
            document.querySelectorAll('.customStickers').forEach(customStickers => {
                let currentSticker = customStickers.querySelectorAll('.stickerSlot')[index];
                currentSticker.setAttribute('data-tooltip', `${stickerInfo.name} - Condition: ${wear}%`);
                currentSticker.querySelector('img').setAttribute('style', `opacity: ${(wear > 10) ? wear / 100 : (wear / 100) + 0.1}`);
            });
        });
    }
}

function hideFloatBars(){
    document.querySelectorAll('.floatBar').forEach(floatBar => floatBar.classList.add('hidden'));
}

function findElementByAssetID(assetID){ return document.getElementById(`730_2_${assetID}`)}

function addFloatIndicatorsToPage(page){
    page.querySelectorAll('.item.app730.context2').forEach(itemElement => {
        let assetID = getAssetIDOfElement(itemElement);
        let item = getItemByAssetID(items, assetID);
        if (item.inspectLink !== null && item.type !== itemTypes.collectible && item.type !== itemTypes.container && item.type !== itemTypes.graffiti && item.type !== itemTypes.c4 && item.type !== itemTypes.sticker){
            if (item.floatInfo === null) {
                floatQueue.jobs.push({
                    type: 'inventory',
                    assetID: assetID,
                    inspectLink: item.inspectLink
                });
            }
            else addFloatIndicator(itemElement, item.floatInfo);
        }
    });
    workOnFloatQueue();
}

function updateFloatAndPatternElements(item) {
    setFloatBarWithData(item.floatInfo);
    setPatternInfo(item.patternInfo);
    setStickerInfo(item.floatInfo.stickers);
}
const floatBar = getFloatBarSkeleton('inventory');
const upperModule = `
<div class="upperModule">
    <div class="nametag"></div>
    <div class="descriptor customStickers"></div>
    <div class="duplicate">x1</div>
    ${floatBar}
    <div class="patternInfo"></div>
</div>
`;

const lowerModule = `<a class="lowerModule">
    <div class="descriptor tradability tradabilityDiv"></div>
    <div class="descriptor countdown"></div>
    <div class="descriptor tradability bookmark">Bookmark and Notify</div>
</a>`;

const tradable = '<span class="tradable">Tradable</span>';
const notTradable = '<span class="not_tradable">Not Tradable</span>';
const dopplerPhase = '<div class="dopplerPhase"><span></span></div>';

// the promise will be stored here temporarily
let inventoryPromise = undefined;

//listens to the message events on the extension side of the communication
window.addEventListener('message', e => {
    if (e.data.type === 'inventory') {
        inventoryPromise(e.data);
        inventoryPromise = undefined;
    }
    else if (e.data.type === 'allItemsLoaded') {
        if (e.data.allItemsLoaded) doInitSorting();
        else loadFullInventory();
    }
});

//sends the message to the page side to get the info
const getInventory = () => {
    window.postMessage({type: 'requestInventory'}, '*');
    return new Promise(resolve => {inventoryPromise = resolve});
};

//this injected script listens to the messages from the extension side and responds with the page context info needed
let getItems = `
    window.addEventListener('message', (e) => {
        if (e.data.type == 'requestInventory') {
            let inventory = UserYou.getInventory(730,2);
            let assets = inventory.m_rgAssets;
            let assetKeys= Object.keys(assets);
            let trimmedAssets = [];
            
            for(let assetKey of assetKeys){
                let asset = {
                    amount: assets[assetKey].amount,
                    assetid: assets[assetKey].assetid,
                    contextid: assets[assetKey].contextid,
                    description: assets[assetKey].description
                };
                trimmedAssets.push(asset);
            }
            window.postMessage({
                type: 'inventory',
                inventory: trimmedAssets
            }, '*');
        }
    });`;
injectToPage(getItems, false, 'getItems');

// mutation observer observes changes on the right side of the inventory interface, this is a workaround for waiting for ajax calls to finish when the page changes
MutationObserver = window.MutationObserver;

let observer = new MutationObserver(() => {
    if (isCSGOInventoryActive('inventory')){
        addElements();
        addFunctionBar();
    }
    else cleanUpElements(true);
});

let observer2 = new MutationObserver(() => {addPerItemInfo(false)});

// does not execute if inventory is private or failed to load the page (502 for example, mostly when steam is dead)
if (document.getElementById('no_inventories') === null && document.getElementById('iteminfo0') !== null){
    observer.observe(document.getElementById('iteminfo0'), {
        subtree: false,
        attributes: true
    });

    observer2.observe(document.getElementById('inventories'),{
        subtree: false,
        attributes: true
    });
}

overridePopulateActions();
updateLoggedInUserID();

chrome.storage.local.get('hideOtherExtensionPrices', (result) => {if (result.hideOtherExtensionPrices) hideOtherExtensionPrices()});

let items = [];
requestInventory();

// to refresh the trade lock remaining indicators
setInterval(() => {if (!document.hidden) addPerItemInfo(true)}, 60000); // true means it's only for updating the time remaining indicators

//variables for the countdown recursive logic
let countingDown = false;
let countDownID = '';

let listenSelectClicks = (event) => {
    if (event.target.parentElement.classList.contains('item') && event.target.parentElement.classList.contains('app730') && event.target.parentElement.classList.contains('context2')) {
        event.target.parentElement.classList.toggle("selected");
        updateSelectedValue();
    }
};

// reloads the page on extension update/reload/uninstall
chrome.runtime.connect().onDisconnect.addListener(() =>{location.reload()});