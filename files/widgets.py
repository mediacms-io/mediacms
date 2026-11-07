import json

from django import forms
from django.utils.safestring import mark_safe

from .models import Category


class CategoryModalWidget(forms.SelectMultiple):
    """Two-panel category selector with modal"""

    class Media:
        css = {'all': ('css/category_modal.css',)}
        js = ('js/category_modal.js',)

    def render(self, name, value, attrs=None, renderer=None):
        is_lms_mode = getattr(self, 'is_lms_mode', False)

        # Get all categories as JSON
        categories = []
        for opt_value, opt_label in self.choices:
            if opt_value:  # Skip empty choice
                # Extract the actual ID value from ModelChoiceIteratorValue if needed
                category_id = opt_value.value if hasattr(opt_value, 'value') else opt_value

                # Get is_lms_course info from the Category object
                try:
                    cat_obj = Category.objects.get(id=category_id)
                    categories.append({'id': str(category_id), 'title': str(opt_label), 'is_lms_course': cat_obj.is_lms_course})
                except Category.DoesNotExist:
                    categories.append({'id': str(category_id), 'title': str(opt_label), 'is_lms_course': False})

        all_categories_json = json.dumps(categories)
        selected_ids_json = json.dumps([str(v) for v in (value or [])])
        lms_mode_json = json.dumps(is_lms_mode)

        search_placeholder = "Search courses..." if is_lms_mode else "Search categories..."
        selected_header = "Selected Courses" if is_lms_mode else "Selected Categories"

        html = f'''<div class="category-widget" data-name="{name}">
  <div class="category-content">
    <div class="category-panel">
      <input type="text" class="category-search" placeholder="{search_placeholder}">
      <div class="category-list scrollable" data-panel="left"></div>
    </div>
    <div class="category-panel">
      <h3>{selected_header}</h3>
      <div class="category-list scrollable" data-panel="right"></div>
    </div>
  </div>
  <div class="hidden-inputs"></div>
  <script type="application/json" class="category-data">{{"all":{all_categories_json},"selected":{selected_ids_json},"lms_mode":{lms_mode_json}}}</script>
</div>'''

        return mark_safe(html)
