## How To Add A Static Page To The Sidebar

### 1. Create your html page in templates/cms/ 
e.g. duplicate and rename about.html
```
sudo cp templates/cms/about.html templates/cms/volunteer.html
```

### 2. Create your css file in static/css/ 
```
touch static/css/volunteer.css
```

### 3. In your html file, update block headermeta to reflect your new page
```
{% block headermeta %}
<meta property="og:title" content="Volunteer - {{PORTAL_NAME}}">
<meta property="og:type" content="website">
<meta property="og:description" content="">
<meta name="twitter:card" content="summary">
<script type="application/ld+json">
{
	"@context": "https://schema.org",
	"@type": "BreadcrumbList",
	"itemListElement": [{
		"@type": "ListItem",
		"position": 1,
        "name": "{{PORTAL_NAME}}",
        "item": {
			"@type": "WebPage",
	        "@id": "{{FRONTEND_HOST}}"
	    }
    },
    {
		"@type": "ListItem",
		"position": 2,
        "name": "Volunteer",
        "item": {
			"@type": "VolunteerPage",
	        "@id": "{{FRONTEND_HOST}}/volunteer"
	    }
    }]
}
</script>
<link href="{% static "css/volunteer.css" %}" rel="stylesheet"/>
{% endblock headermeta %}
```

### 4. In your html file, update block innercontent to reflect your actual content
Write whatever you like.

### 5. In your css file, write matching styles for you html file.
Write whatever you like.

### 6. Add your view to files/views.py
```
def volunteer(request):
    """Volunteer view"""
    context = {}
    return render(request, "cms/volunteer.html", context)
```

### 7. Add your url pattern to files/urls.py
```
urlpatterns = [
    url(r"^$", views.index),
    url(r"^about", views.about, name="about"),
    url(r"^volunteer", views.volunteer, name="volunteer"),
```

### 8. Add your page to the left sidebar
To add a link to your page as a menu item in the left sidebar,
add the following code after the last line in _commons.js   
```
/* Checks that a given selector has loaded. */
const checkElement = async selector => {
    while ( document.querySelector(selector) === null) {
      await new Promise( resolve =>  requestAnimationFrame(resolve) )
    }
    return document.querySelector(selector); 
  };

/* Checks that sidebar nav menu has loaded, then adds menu item. */
checkElement('.nav-menu')
.then((element) => {
     (function(){    
        var a = document.createElement('a');        
        a.href = "/volunteer";
        a.title = "Volunteer";
       
        var s = document.createElement('span');
        s.className = "menu-item-icon";

        var icon = document.createElement('i');
        icon.className = "material-icons";
        icon.setAttribute("data-icon", "people");

        s.appendChild(icon);
        a.appendChild(s);
    
        var linkText = document.createTextNode("Volunteer");
        var t = document.createElement('span');

        t.appendChild(linkText);
        a.appendChild(t);

        var listItem = document.createElement('li');
        listItem.className = "link-item";
        listItem.appendChild(a);

        //if signed out use 3rd nav-menu
        var elem = document.querySelector(".nav-menu:nth-child(3) nav ul"); 
        var loc = elem.innerText;
        if (loc.includes("About")){
          elem.insertBefore(listItem, elem.children[2]);
        } else { //if signed in use 4th nav-menu
          elem = document.querySelector(".nav-menu:nth-child(4) nav ul");
          elem.insertBefore(listItem, elem.children[2]);
        }       
    })();
});
```

### 9. Restart the mediacms web server
On docker:
```
sudo docker stop mediacms_web_1 && sudo docker start mediacms_web_1
```

Otherwise
```
sudo systemctl restart mediacms
```
