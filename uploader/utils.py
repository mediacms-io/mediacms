from importlib import import_module

from django.core.exceptions import ImproperlyConfigured


def import_class(path):
    path_bits = path.split(".")

    if len(path_bits) < 2:
        message = "'{0}' is not a complete Python path.".format(path)
        raise ImproperlyConfigured(message)

    class_name = path_bits.pop()
    module_path = ".".join(path_bits)
    module_itself = import_module(module_path)

    if not hasattr(module_itself, class_name):
        message = "The Python module '{}' has no '{}' class.".format(module_path, class_name)
        raise ImportError(message)

    return getattr(module_itself, class_name)
