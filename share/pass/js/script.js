var data = [
	{
		firstName: "周金龙",
		lastName: "Reibach",
		title: "Post-It Detergent Manager",
		bio: "Lorem ipsum",
		mail: "jr@diff.com",
		phone:"+58 58 403 404",
		pic: "https://zjlloveo0.github.io/share/pass/img/AdobePhotoshop.png"
	},
	{
		firstName: "Allan",
		lastName: "Dietmark",
		title: "Key-Lime Account Manager",
		bio: "Lorem ipsum",
		mail: "adiet@jorm.com",
		phone:"+58 58 403 404",
		pic: "https://images.unsplash.com/photo-1553094547-6950283d412a?ixlib=rb-1.2.1&q=80&fm=jpg&crop=entropy&cs=tinysrgb&w=400&fit=max&ixid=eyJhcHBfaWQiOjE0NTg5fQ"
	},
	{
		firstName: "Allan",
		lastName: "Bundt",
		title: "Motherboard Sanitation Consultant",
		bio: "Lorem ipsum",
		mail: "bundt@larp.com",
		phone:"+58 58 403 404",
		pic: "https://images.unsplash.com/photo-1542178243-bc20204b769f?ixlib=rb-1.2.1&q=80&fm=jpg&crop=entropy&cs=tinysrgb&w=400&fit=max&ixid=eyJhcHBfaWQiOjE0NTg5fQ"
	},
	{
		firstName: "Consuela",
		lastName: "Feursaltz",
		title: "Customer",
		bio: "Lorem ipsum",
		mail: "feurfrei@larp.com",
		phone:"+58 58 403 404",
		pic: "https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?ixlib=rb-1.2.1&q=80&fm=jpg&crop=entropy&cs=tinysrgb&w=400&fit=max&ixid=eyJhcHBfaWQiOjE0NTg5fQ"
	},
	{
		firstName: "Adrian",
		lastName: "Berkowitz",
		title: "Customer",
		bio: "Lorem ipsum",
		mail: "theberk@kmail.com",
		phone:"+58 58 403 404",
		pic: "https://images.unsplash.com/photo-1519255576365-f231aedb1386?ixlib=rb-1.2.1&q=80&fm=jpg&crop=entropy&cs=tinysrgb&w=400&fit=max&ixid=eyJhcHBfaWQiOjE0NTg5fQ"
	},
	{
		firstName: "Carlos",
		lastName: "Freeman",
		title: "Spreadsheet Controller",
		bio: "Lorem ipsum",
		mail: "free@bmail.com",
		phone:"+58 58 403 404",
		pic: "https://images.unsplash.com/photo-1553798194-cc0213ae7f99?ixlib=rb-1.2.1&q=80&fm=jpg&crop=entropy&cs=tinysrgb&w=400&fit=max&ixid=eyJhcHBfaWQiOjE0NTg5fQ"
	},
	{
		firstName: "Linda",
		lastName: "Dinkleberg",
		title: "Murder Dome Manager",
		bio: "Lorem ipsum",
		mail: "linda@dimmadome.com",
		phone:"+58 58 403 404",
		pic: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-1.2.1&q=80&fm=jpg&crop=entropy&cs=tinysrgb&w=400&fit=max&ixid=eyJhcHBfaWQiOjE0NTg5fQ"
	},
	{
		firstName: "Maria",
		lastName: "Platz",
		title: "Murder Dome Sanitation",
		bio: "Lorem ipsum",
		mail: "maria@dimmadome.com",
		phone:"+58 58 403 404",
		pic: "https://images.unsplash.com/photo-1531251445707-1f000e1e87d0?ixlib=rb-1.2.1&q=80&fm=jpg&crop=entropy&cs=tinysrgb&w=400&fit=max&ixid=eyJhcHBfaWQiOjE0NTg5fQ"
	}
]

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

var cfg = {
	data: data,
	searchFields: ["firstName", "lastName", "title"],
	showSearchbar: true,
	itemTemplate: "tmpl-item"
}

$(function(){
	$("#test").searchList(cfg);
})