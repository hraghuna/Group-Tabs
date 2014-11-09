// Copyright (c) 2014 Hari Raghunathan. All rights reserved.
function start() {
    // We require all the tab information to be populated.
    groupingInfo = {};
    saveGrouping();
    chrome.windows.getAll({
        "populate": true
    }, groupTabs);
}

function groupTabs(windows) {
    var numWindows = windows.length;
    createData = [];
    deleteData = [];
    groupIDIndex = 0;
    for (var i = 0; i < numWindows; ++i) {
        var win = windows[i];
        var tabPosition = 0;
        var numTabs = win.tabs.length;
        for (var j = 0; j < numTabs; ++j) {
            var tab = win.tabs[j];
            // Move the tab based on grouping to the right window.
            var url = tab.url;
            var id = 1;
            var foundGroup = false;
            var groupID = 0; //0 is for all ungrouped tabs
            for (var key in groupingInfo) {
                var group = groupingInfo[key];
                for (var k = 0; k < group.length; ++k) {
                    if (url.indexOf(group[k]) !== -1) {
                        groupID = id;
                        foundGroup = true;
                        break;
                    }
                }
                ++id;
                if (foundGroup) {
                    break;
                }
            }
            if (typeof(createData[groupID]) === 'undefined') {
                createData[groupID] = {};
                createData[groupID].tab = [];
            }
            createData[groupID].tab.push(tab);
        }
    }
    var createDataLen = createData.length;
    var i = 0;
    while (i < createDataLen) {
        if (typeof(createData[i]) === 'undefined') { // if no uncategorized urls found, remove this information
            createData.splice(i, 1);
            createDataLen = createData.length;
        } else {
            ++i;
        }
    }
	oldWindowIds = []; //global variable to keep track of oldWindowIds
	for (var i = 0; i < windows.length; ++i) {
		oldWindowIds.push(windows[i].id);
	}
	
    for (var dataIdx = 0; dataIdx < createData.length; ++dataIdx) {
		//only create windwos without passing in urls since we want to move the urls not recreate them. This will retain meta data like back, etc
        //focused false needed - otherwise extension popup closes when new window is created - hence nothing will be executed from there on
		chrome.windows.create({focused:false}); 
    }
	chrome.windows.getAll({
        "populate": true
    }, moveTabs);

}

function moveTabs(windows) {
	var newWindows = [];
	var newWindowIds = [];	
	var newWin;
	// get window ids of newly created windows
	for (var i = 0; i < windows.length; ++i) {
		if (oldWindowIds.indexOf(windows[i].id) == -1) { //check if this is not a old window id
			newWindowIds.push(windows[i].id);
			newWindows.push(windows[i]);
		}
	}
	for (var groupIDIndex = 0; groupIDIndex < createData.length; ++groupIDIndex) {
		var tabsInThisGroup = createData[groupIDIndex].tab;
		var tabPosition = 1;		
		for (var i = 0; i < tabsInThisGroup.length; ++i) {
			chrome.tabs.move(tabsInThisGroup[i].id, {
				"windowId": newWindowIds[groupIDIndex],//each group has a new window created
				"index": tabPosition++
			});
		}		
		// remove tab 0 since this is an empty tab created when opening a new window
		chrome.tabs.remove(newWindows[groupIDIndex].tabs[0].id);
    }	
}

function addRow() {
    // clear error message
    var messageDiv = document.getElementById('messageDiv');
    messageDiv.style.display = 'none';

    var rowID = 'row' + totTableRows;
    var siteCell = "enter site";
    var groupCell = "enter group";
    var groupCellID = 'groupcell' + totTableRows;
    var siteCellID = 'sitecell' + totTableRows;
    var row = $("<tr id = '" + rowID + "'><td><div contenteditable class = 'tablecell' id = '" + groupCellID + "'>" + groupCell +
        "</div></td><td><div contenteditable class = 'tablecell' id = '" + siteCellID + "'>" + siteCell + "</div></td></tr>");
    $("#groupingTable").append(row);
    var groupCellNode = $('#' + groupCellID).get(0);
    var siteCellNode = $('#' + siteCellID).get(0);
	
    // when cell is tabbed into, cursor should be at the end of the cell -
    // create onfocus callback for this for both group and site cells
    var onFocusFunc = function() {
        var messageDiv = document.getElementById('messageDiv');
        messageDiv.style.display = 'none';
        var sel, range
        if (window.getSelection && document.createRange) {
            range = document.createRange();
            range.selectNodeContents($('#' + this.id).get(0));
            range.collapse(false);
            sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        } else if (document.body.createTextRange) {
            range = document.body.createTextRange();
            range.moveToElementText(this);
            range.collapse(false);
            range.select();
        }
        // keep track of current row selection	 - for row deletion		
        var currentCell = this.parentElement;
        currentRow = currentCell.parentElement;
    };
    groupCellNode.onfocus = onFocusFunc;
    siteCellNode.onfocus = onFocusFunc;

    //scroll to the newly added row
    var parentDiv = document.getElementById('tableScroll');
    var newRow = document.getElementById(rowID);
    parentDiv.scrollTop = newRow.offsetTop;

    groupCellNode.focus(); // focus on the group cell of the new row
    totTableRows++;
}

function deleteRow() {
    // clear error message
    var messageDiv = document.getElementById('messageDiv');
    messageDiv.style.display = 'none';
    var currentRowID = currentRow.id;
	
    // Find row adjacent to currentRow in order to set that row to selected
    // after currentRow is deleted.
    var rowToSetSelected = $('#' + currentRowID).next();
    if (rowToSetSelected.length === 0) {
        rowToSetSelected = $('#' + currentRowID).prev();
    }
    $('#' + currentRowID).remove();
    // focus on rowToSetSelected and set it as current
    if (rowToSetSelected.length !== 0) {
        var tdsToSetSelected = rowToSetSelected[0].children;
        var groupCellNode = tdsToSetSelected[0].children;
        groupCellNode[0].focus();
    }
}

function checkForDuplicates(groupingInfo, site) {
    for (var key in groupingInfo) {
        var siteInfo = groupingInfo[key];
        if (siteInfo.indexOf(site) != -1) {
            return true;
        }
    }
    return false;
}

function saveGrouping() {
    groupingInfo = {};
    var dupFound = false;
    $('#groupingTable tr').each(function() {
        var tds = $(this).find("td");
        var defaultGroupValue = "enter group";
        var defaultSiteValue = "enter site";
        if (tds.length !== 0) {
            var divs = $(tds).find("div");
            var group = divs[0].innerText.toLowerCase();
            var site = divs[1].innerText.toLowerCase();
            if (group === defaultGroupValue || site == defaultSiteValue) {
                var defaultRowID = divs[0].parentElement.parentElement.id;
                defaultRows.push(defaultRowID);
                return true; //continue to next iteration since default values need not be checked for dups or saved
            }
            if (typeof(groupingInfo[group]) === 'undefined') {
                groupingInfo[group] = [];
            }
            dupFound = checkForDuplicates(groupingInfo, site)
            groupingInfo[group].push(site);
            return (!dupFound);
        }
    });
    var messageDiv = document.getElementById('messageDiv');
    if (!dupFound) {
        chrome.storage.sync.set({
            'groupingInfo': groupingInfo
        }, function() {
            // Remove default rows before saving
            for (var i = 0; i < defaultRows.length; ++i) {
                $('#' + defaultRows[i]).remove();
            }
            // Notify that we saved.
            messageDiv.innerHTML = 'Saved grouping';
            messageDiv.style.color = "green";
        });
    } else {
        var messageDiv = document.getElementById('messageDiv');
        messageDiv.innerHTML = 'Error: same site being added across multiple groups - fix and try again';
        messageDiv.style.color = "red";
    }
    messageDiv.style.display = 'inline';
}


window.addEventListener("load", function() {

	// create an initial first time grouping
    groupingInfo = {};
    groupingInfo.work = [];
    groupingInfo.work.push('stackoverflow.com');
    groupingInfo.work.push('msdn.com');

    groupingInfo.personal = [];
    groupingInfo.personal.push('mail');
    groupingInfo.personal.push('facebook');

    groupingInfo.music = [];
    groupingInfo.music.push('pandora.com');
    groupingInfo.music.push('youtube.com');

    defaultRows = [];
    chrome.storage.sync.get('groupingInfo', function(storedGroupingInfo) {
        //use store grouping info only it is non empty - otherwise default
        if (Object.keys(storedGroupingInfo).length !== 0) {
            groupingInfo = storedGroupingInfo.groupingInfo;
			//console.log(storedGroupingInfo);
			//console.log(Object.keys(storedGroupingInfo));
			//console.log(groupingInfo);
        }
        totTableRows = 0;
        for (var key in groupingInfo) {
            var groupCell = key;
            for (var i = 0; i < groupingInfo[key].length; ++i) {
                var rowID = 'row' + totTableRows;
                var siteCell = groupingInfo[key][i];
                var groupCellID = 'groupcell' + totTableRows;
                var siteCellID = 'sitecell' + totTableRows;
                var row = $("<tr id = '" + rowID + "'><td><div contenteditable class = 'tablecell' id = '" + groupCellID + "'>" + groupCell +
                    "</div></td><td><div contenteditable class = 'tablecell' id = '" + siteCellID + "'>" + siteCell + "</div></td></tr>");
                $("#groupingTable").append(row);
                var groupCellNode = $('#' + groupCellID).get(0);
                var siteCellNode = $('#' + siteCellID).get(0);
				
                // when cell is tabbed into, cursor should be at the end of the cell -
                // create onfocus callback for this for both group and site cells
                var onFocusFunc = function() {
                    var messageDiv = document.getElementById('messageDiv');
                    messageDiv.style.display = 'none';
                    var sel, range;
                    if (window.getSelection && document.createRange) {
                        range = document.createRange();
                        range.selectNodeContents($('#' + this.id).get(0));
                        range.collapse(false);
                        sel = window.getSelection();
                        sel.removeAllRanges();
                        sel.addRange(range);
                    } else if (document.body.createTextRange) {
                        range = document.body.createTextRange();
                        range.moveToElementText(this);
                        range.collapse(false);
                        range.select();
                    }
                    // keep track of current row selection	 - for row deletion		
                    var currentCell = this.parentElement;
                    currentRow = currentCell.parentElement;
                };
                groupCellNode.onfocus = onFocusFunc;
                siteCellNode.onfocus = onFocusFunc;

                totTableRows++;
            }
        }
    });

    // clear error message
    $("#searchInput").focus(function() {
        var messageDiv = document.getElementById('messageDiv');
        messageDiv.style.display = 'none';
    });

    $("#searchInput").keyup(function() {
        var rows = $("#groupingTableBody").find("tr").hide();
        if (this.value.length) {
            var data = this.value.split(" ");
            $.each(data, function(i, v) {
                rows.filter(":contains('" + v + "')").show();
            });
        } else rows.show();
    });

    document.getElementById("addRow")
        .addEventListener("click", addRow, false);
    document.getElementById("deleteRow")
        .addEventListener("click", deleteRow, false);
    document.getElementById("groupTabs")
        .addEventListener("click", start, false);
    document.getElementById("saveGrouping")
        .addEventListener("click", saveGrouping, false);

}, false);