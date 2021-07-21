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
