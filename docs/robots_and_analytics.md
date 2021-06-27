# Google Analytics

1. Create a file:

``` touch $DIR/mediacms/templates/tracking.html ```

2. Add the Gtag/Analytics script

3. Inside ``` $DIR/mediacms/templates/root.html``` you'll see a file like this one: 

```
<head>
    {% block head %}

        <title>{% block headtitle %}{{PORTAL_NAME}}{% endblock headtitle %}</title>

        {% include "common/head-meta.html" %}

        {% block headermeta %}
        
        <meta property="og:title" content="{{PORTAL_NAME}}">
        <meta property="og:type" content="website">

        {%endblock headermeta %}

        {% block externallinks %}{% endblock externallinks %}

        {% include "common/head-links.html" %}

        {% block topimports %}{%endblock topimports %}

        {% include "config/index.html" %}
      
    {% endblock head %}

</head>
```

4. Add  ``` {% include "tracking.html" %} ``` at the end inside the section ```<head>```
  
5. If you are using Docker and didn't  mount the entire dir you need to bind a new volume: 
```
  
    web:
    image: mediacms/mediacms:latest
    restart: unless-stopped
    ports:
      - "80:80"
    deploy:
      replicas: 1
    volumes:
      - ./templates/root.html:/home/mediacms.io/mediacms/templates/root.html
      - ./templates/tracking.html://home/mediacms.io/mediacms/templates/tracking.html
  
 ```
  
  
 # Robots.txt
 
1. Mediacms is missing robots.txt that can impact your seo. 
Let's add it: 
  
  
  ``` touch $DIR/mediacms/cms/robots.txt ```
  
2. Populate it with what you want: 
  
```   
User-Agent: *
Allow: /
Disallow: /admin
``` 
  
3. Inside ```files/views.py``` edit the default import and add HttpResponse under HttpResponseRedirect.
  
```
  from django.http import (
    HttpResponseRedirect,
    HttpResponse,
)
```
  
4. Add a new view:
  
```
  def robots(request):
    f = open('/home/mediacms.io/mediacms/templates/cms/robots.txt', 'r')
    file_content = f.read()
    f.close()
    return HttpResponse(file_content, content_type="text/plain")
```
  
If you are using Docker the path is the one inside the container. 

5. Open ```files/urls.py``` and add: 
```
 urlpatterns = [
    url(r"^robots.txt", views.robots, name="robots"),
```
Inside urlpatterns. 
 
6. If you are using Docker and did not mount the entire folder before you need to map the volumes:
  
```
  web:
    image: mediacms/mediacms:latest
    restart: unless-stopped
    ports:
      - "80:80"
    deploy:
      replicas: 1
    volumes:
      - ./files/views.py:/home/mediacms.io/mediacms/files/views.py
      - ./files/urls.py:/home/mediacms.io/mediacms/files/urls.py  
      - ./templates/cms/robots.txt:/home/mediacms.io/mediacms/templates/cms/robots.txt
```
  
7. Call ```https://yourwebsite.com/robots.txt``` to check if everything is working.

 
