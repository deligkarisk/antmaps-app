/*
* Each mode needs to have the following external methods:
* activateMode() -- called when the user switches to this mode
* deactivateMode() -- called to clean up, when the user switches to a different mode
* updateData() -- called when the most specific select box is selected
* resetData() -- clear the currently-saved data for this mode
* resetView() -- called when the map has to be re-drawn, like on zoom
* bentityInfoLabelHTML(d, i) -- returns the info-label text for a bentity, given D3-bound data d and index i
*/





//////////////////////////////////////////////////////////////////////////
//  SPECIES MODE
//
//  Functionalities for species mode: gets data, gets current species, draws points,
//                                    recolors map, draws legend, resets mode 
//  External Functions: resetData, resetView, activateMode, deactivateMode, updateData,
//						bentityInfoLabelHTML, circleHighlight, choropleth
//	Internal Functions: getSelectedSpecies, 
//////////////////////////////////////////////////////////////////////////


var speciesMode = (function() {
	var external = {};


	var categoryCodes = ["N", "E", "I", "D", "V"]; // legend will be in this order
	var categoryColors = ["#F7E46D","#A7BD5B","#DC574E","#8DC7B8","#ED9355"];
	var categoryNames = {"N": "Native",
						 "I": "Indoor Introduced",
						 "E": "Exotic",
						 "D": "Dubious",
						 "V": "Needs Verification"};
	var notPresentColor = "white";





	var overlappingBentities = {
		"BEN20533" : { domID: "poly_BEN20533",  // India
			children: ["poly_BEN20200", "poly_BEN20177", "poly_BEN20363", "poly_BEN20170", "poly_BEN20372", "poly_BEN20487", "poly_BEN20046", "poly_BEN20505", "poly_BEN20166", "poly_BEN20245", "poly_BEN20340", "poly_BEN20247", "poly_BEN20012", "poly_BEN20148", "poly_BEN20215", "poly_BEN20219", "poly_BEN20457", "poly_BEN20419", "poly_BEN20024", "poly_BEN20267", "poly_BEN20291", "poly_BEN20255", "poly_BEN20280", "poly_BEN20473"]
			},
		"BEN20532": { domID: "poly_BEN20532", // Columbia
			children: ["poly_BEN20226", "poly_BEN20027", "poly_BEN20246", "poly_BEN20074", "poly_BEN20047", "poly_BEN20441", "poly_BEN20521", "poly_BEN20319", "poly_BEN20018", "poly_BEN20399", "poly_BEN20080", "poly_BEN20052", "poly_BEN20068", "poly_BEN20379", "poly_BEN20061", "poly_BEN20100", "poly_BEN20370", "poly_BEN20489", "poly_BEN20470", "poly_BEN20110", "poly_BEN20496", "poly_BEN20489", "poly_BEN20269", "poly_BEN20070", "poly_BEN20183", "poly_BEN20160", "poly_BEN20154", "poly_BEN20293", "poly_BEN20364", "poly_BEN20067", "poly_BEN20492", "poly_BEN20526"]
		}
	}





	// the current data selected and mapped by the user
	var currentData = null;
	external.resetData = function() {
		currentData = {
		'speciesName': null, // current species name
		'speciesCode': null, // current species code
		'pointRecords': null, // current points to show, with {gabi_acc_number:xxx, lat:xxx, lon:xxx} for each
		'bentityCategories': {} // keys are bentity GID's, values are category codes
		}
	};
	external.resetData();
	
	
	

	// taxon_code is the key to send the server, speciesName is what to display to the user
	function getSelectBoxSpecies() {
			return { taxon_code:  $('#sppView-species-select').val(),
					 speciesName: $('#sppView-species-select option:selected').text() };
	}
	
	
	$('#sppView-species-select').change(function() {
		speciesMode.updateData();
	});
	
	$('#sppView-genus-select').change(function(){
		$('#querySpecies').css('margin-left',0);
	});
	
	$('#sppView-subfamily-select').change(function(){
		$('#querySpecies').css('margin-left',20);
	});
	
	
	// Re-draws all the points on the map
	// Called when the user updates the data, and when the map needs to be re-drawn 
	// (eg every time the user zooms)
	external.resetView = function() {
	
		
		
		if (currentData.pointRecords) {
		
			var g = baseMap.getOverlayG();
	
			g.selectAll('.dot').remove(); // clear all dots
	
			  // plot dots
			  g.selectAll('.dot')
				.data(currentData.pointRecords)
				.enter()
				.append('circle')
				.attr('class', 'dot')
				.attr('cx',function(d){
					return baseMap.getProjection()([d.lon,d.lat]).x;
				})
				.attr('cy',function(d){
					return baseMap.getProjection()([d.lon,d.lat]).y;
				})
				.attr("fill","#F05253")
				.attr('r',4)
				.on("click",mapUtilities.infoPanelPoints)
				.on("mouseover", function(d, i) {
					var labelHTML = "<h3 class='text-center'>" + d.gabi_acc_number + "</h3>";
					mapUtilities.infoLabel(d, "dot" + i, 0, labelHTML);
				})
				.on("mouseout", function(d,i) {
					mapUtilities.removeInfoLabel(d, "dot"+i);
				})
				.on("mouseover.border",function(){
					d3.select(this)
					.transition()
					.duration(1000)
					.style({
						'stroke-width':10,
						'stroke-opacity':0.3,
						'fill-opacity':1,
						'stroke':'white',
						'cursor':'pointer'
					});
				})
				.on("mouseout.border",function(){
					d3.select(this)
					.transition()
					.duration(2000)
					.style({
						'stroke-width':1,
						'stroke-opacity':1,
						'fill-opacity':1,
						'stroke':'#F05253'
					});
				});
		
		}
	}
	


	
	// called when this mode is selected
	external.activateMode = function() {
		choropleth();
		renderPoints();
		
	}
	
	
	// called to reset the map back to its original state, without any data
	// for this mode, so a different map mode can render the map
	external.deactivateMode = function() {
		baseMap.getOverlayG().selectAll('.dot').remove(); // clear all dots
		baseMap.resetChoropleth();
		baseMap.resetOverlappingBentities();
	}
	
	
	
	
	// called when the user presses the "map" button
	// speciesCode is optional, if not provided it will be looked up from select boxes
	external.updateData = function(selectedSpp) {
		
		// get selectedSpp from select box if it wasn't provided as an argument
		var selectedSpp = selectedSpp || getSelectBoxSpecies();
	
	
		if (!selectedSpp.taxon_code) {
			alert('Please select a species to map.');
			return;
		}	
	
		external.resetData();
		currentData.speciesCode = selectedSpp.taxon_code;
		currentData.speciesName = selectedSpp.speciesName;
	
		
		
		// show loading graphic
		$("#loading-message").show();
		
		
		
		// get status for each bentity
		$.getJSON('/dataserver/species-bentity-categories', {taxon_code: selectedSpp.taxon_code})
		.fail(controls.whoopsNetworkError)
		.done( function(data) {
		
			// make sure the user hasn't already selected a different species
			if (selectedSpp.taxon_code == currentData.speciesCode) {
			
				if (data.bentities) {
				
					if (data.bentities.length==0) { 
						alert('No data for this species!');
					};
				
				
					// switch representation of bentities from list to object
					for (var i = 0; i < data.bentities.length; i++) {
						var record = data.bentities[i];
						currentData.bentityCategories[record.gid] = record.category;
					}
				
				}
				
				if (controls.getCurrentModeName() == "speciesMode") { 
					// make sure the user hasn't switched to a different mode already
					choropleth();
				}
				
			}
			
		})
		.always( function() {
			$("#loading-message").hide();
		});
		
		
		
		// get species points
		$.getJSON('/dataserver/species-points', {taxon_code: selectedSpp.taxon_code})
		.done(function(data) {
			
			// make sure the user hasn't already selected a different species
			if (selectedSpp.taxon_code == currentData.speciesCode) {
			
				if (data.records) {
					currentData.pointRecords = data.records;
				
					renderPoints();
				} 
			
			}
		})
		.fail(controls.whoopsNetworkError);
	};
	
	
	
	
	
	// SPECIES AUTOCOMPLETE BOX
	(function() {

		$('#species-autocomplete')		
		
		.val("") // clear value on page load (don't remember previously-entered value)
		
		// update data when a species is selected from the autocomplete box
		.autocomplete({
			minLength: 3, // wait for at least 3 characters
		
			// look up species list from server when the user starts typing
			source: function(request, response) {
				$.getJSON('/dataserver/species-autocomplete', {q: request.term})
				.done(function(data) {
					response(data.species);
				})
				.fail(function(data) {
					external.whoopsNetworkError();
					response([]);
				});
			}
		})

		// update data when an option is selected
		.on("autocompleteselect", function(event, ui) {
			external.updateData({taxon_code:ui.item.value, speciesName:ui.item.label});
		
			// fill the select box with the item's label instead of value (no periods)
			$(this).val(ui.item.label);
			return false;
		})
	
		// when the user focuses a list item without selecting it, show the label instead of value
		.on("autocompletefocus", function(event, ui) {
			$(this).val(ui.item.label);
			return false;
		})
	
		// do a search when the text box is clicked, if the text exceeds minlength
		.on("click", function() {
			if($(this).val().length >= $(this).autocomplete("option", "minLength")) {
				$(this).autocomplete("search");
			}
		});
	})();
	
	
	
	
	external.showViewWidgets = function(){
		$("#spp_view").css("display","inline");
		$('#view-title').html('Species Distribution');
	};
	

	
	
	
	// called once points are loaded
	function renderPoints() {
		external.resetView();
	}
	
	
	
	external.bentityInfoLabelHTML = function(d, i) {
		return "<h3 class='text-center'>"
			+ d.properties.bentity2_name + "</h3><br><b>"
			+ (categoryNames[currentData.bentityCategories[d.properties.gid]] || "") + "</b>";
	};
	
	

	
	
	external.circleHighlight = function(data){
				
		var labelAttribute = "<h3 class='text-center'>"+props.gabi_acc_number+"</h3>";
				
		var finalId = props.gabi_acc_number;
				
		var infolabel = d3.select("body").append("div")
					.attr("class", "infolabel") //for styling label
					.attr("id", finalId+"label") //for future access to label div
					.html(labelAttribute) //add text
					.append("div") //add child div for feature name
					.attr("class", "labelname"); //for styling name
	};
	

	
	
	// color regions on the map
	function choropleth() {
		
		// set map title
		var speciesName = currentData.speciesName;
		var currentModeTitle = "Species";
		mapUtilities.setTitle(currentModeTitle,speciesName);
		
		
		// any data to map?
		if (!$.isEmptyObject(currentData.bentityCategories)) {
		
			baseMap.resetOverlappingBentities();
		
			var colorScale = d3.scale.ordinal().domain(categoryCodes).range(categoryColors);
		
			// return a color based on the category for the given bentity D3-bound data	
			var bentityColor = function(d) {
				if (currentData.bentityCategories[d.properties.gid]) {
					return colorScale(currentData.bentityCategories[d.properties.gid]);
				}
				else {
					return notPresentColor;
				}
			};
			
			toggleOverlappingBentities();
			
			baseMap.choropleth(bentityColor);
			
			drawLegend();
		}
		
		
	}
	
	
	
	
	// Check to see whether any of the overlapping bentities (India+Colombia) have data,
	// show them if they do.
	function toggleOverlappingBentities() {
		$.each(baseMap.overlappingBentities, function(bentityID, domIDs) {
			if (currentData.bentityCategories[bentityID]) {
				baseMap.showOverlappingBentity(bentityID);
			}
		});

	}
	
	
	

	function drawLegend() {
		var legendColors = categoryColors.concat([notPresentColor]);
		
		var legendLabels = [];
		for (var i = 0; i < categoryCodes.length; i++) {
			legendLabels.push(categoryNames[categoryCodes[i]]);
		}
		legendLabels.push("Not Present");
		
		mapUtilities.drawLegend(
			d3.select("#species-legend"),
			legendLabels,
			legendColors
		);
	}

	
	external.errorReportData = function() {
		return "Species distribution mode\nSelected species: " + (currentData.speciesName || "none selected");
	}

	return external;
})();
controls.registerModeObject("speciesMode", speciesMode);


