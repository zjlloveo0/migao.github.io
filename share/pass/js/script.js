$.fn.searchList = function(config){
	var $container = $(this);	
	var $search = $("<div class='search-list__search-bar'>")
	var $items = $("<div class='search-list__items'>");
	var $input = $("<input type='text' class='search-list__input' placeholder='Search' />")
	$container.addClass("search-list");
	$container.empty();
	
	var sl = {
		data: config.data,
		searchFields: config.searchFields,
		items: function(){
			return $container.find(".search-list__item");
		},
		search: function(str){
			var items = $container.data("searchList").items();
			var searchFields = $container.data("searchList").searchFields;
			if(!str)
				items.show();
			else{
				items.each(function(){
					var hide = true;
					var item = $(this);
					var data = item.data("object");				
					$.each(searchFields, function(){
						if(data[this].toString().toLowerCase().includes(str.toLowerCase()))
							hide = false;
					});
					if(hide)
						item.hide();
					else
						item.show();
				});
			}
		}
	};
	
	$container.data("searchList", sl);	
	
	$input.on("input", function(){
		$container.data("searchList").search($(this).val());
	});
	
	$search.append($input);
	$container.append($search);
	
	$.each(config.data, function(){
		var $item = $("<div class='search-list__item'>");
		var source = $("#tmpl-item").html();
		var template = Handlebars.compile(source);
		$item.data("object", this);
		$item.append(template(this));
		$items.append($item);
	});
	
	$container.append($search);
	$container.append($items);
}
