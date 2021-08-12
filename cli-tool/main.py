import json

import click

# import django
import requests

# from django.middleware.csrf import CsrfViewMiddleware, get_token
# from django.test import Client
from rich import print
from rich.console import Console
from rich.table import Table

console = Console()

print("Welcome to the CLI Tool of [bold blue]MediaCMS![/bold blue]", ":thumbs_up:")

BASE_URL = 'https://demo.mediacms.io/api/v1'

# django.setup()
# csrf_client = Client(enforce_csrf_checks=True)


@click.group()
def apis():
    """A CLI wrapper for the API of Public APIs."""


# @apis.command()
# def login():
#     """Login to your account."""
#     url = f'{BASE_URL}/login'

#     email = input('Enter your email address')
#     password = input('Enter your password')

#     csrf_client.get(url)
#     csrftoken = csrf_client.cookies['csrftoken']

#     login_data = dict(email=email, password=password, csrfmiddlewaretoken=csrftoken.value, next='/')
#     r = csrf_client.post(url, data=login_data, headers=dict(Referer=url))


@apis.command()
def categories():
    """List all categories."""
    response = requests.get(url=f'{BASE_URL}/categories')
    if response.status_code == 200:
        data_json = json.loads(response.text)

        table = Table(show_header=True, header_style="bold magenta")
        table.add_column("Category")
        table.add_column("Description")

        for data in data_json:
            table.add_row(data['title'], data['description'])

        console.print(table)
    else:
        print(f'Could not get the categories: {response.text}')


@apis.command()
def encodings():
    """List all encoding profiles"""
    response = requests.get(url=f'{BASE_URL}/encode_profiles/')
    if response.status_code == 200:
        data_json = json.loads(response.text)

        table = Table(show_header=True, header_style="bold magenta")
        table.add_column("Name")
        table.add_column("Extension")
        table.add_column("Resolution")
        table.add_column("Codec")
        table.add_column("Description")

        for data in data_json:
            table.add_row(data['name'], data['extension'], str(data['resolution']), data['codec'], data['description'])
        console.print(table)
    else:
        print(f'Could not get the encodings: {response.text}')


if __name__ == '__main__':
    apis()
