import json
import os

import click
import requests
from decouple import config
from rich import print
from rich.console import Console
from rich.table import Table

console = Console()

print("Welcome to the CLI Tool of [bold blue]MediaCMS![/bold blue]", ":thumbs_up:")


BASE_URL = 'https://demo.mediacms.io/api/v1'
AUTH_KEY = ''
USERNAME = ''
EMAIL = ''


def set_envs():
    with open('.env', 'r') as file:
        if not file.read(1):
            print("Use the Login command to set your credential environment variables")
        else:
            global AUTH_KEY, USERNAME, EMAIL
            AUTH_KEY = config('AUTH_KEY')
            USERNAME = config('USERNAME')
            EMAIL = config('EMAIL')


set_envs()


@click.group()
def apis():
    """A CLI wrapper for the MediaCMS API endpoints."""


@apis.command()
def login():
    """Login to your account."""

    email = input('Enter your email address: ')
    password = input('Enter your password: ')

    data = {
        "email": f"{email}",
        "password": f"{password}",
    }

    response = requests.post(url=f'{BASE_URL}/login', data=data)
    if response.status_code == 200:
        username = json.loads(response.text)["username"]
        with open(".env", "w") as file:
            file.writelines(f'AUTH_KEY={json.loads(response.text)["token"]}\n')
            file.writelines(f'EMAIL={json.loads(response.text)["email"]}\n')
            file.writelines(f'USERNAME={json.loads(response.text)["username"]}\n')
        print(f"Welcome to MediaCMS [bold blue]{username}[/bold blue]. Your auth creds have been suceesfully stored in the .env file", ":v:")
    else:
        print(f'Error: {"non_field_errors": ["User not found."]}')


@apis.command()
def upload_media():
    """Upload media to the server"""

    headers = {'authorization': f'Token {AUTH_KEY}'}

    path = input('Enter the location of the file or directory where multiple files are present: ')

    if os.path.isdir(path):
        for filename in os.listdir(path):
            files = {}
            abs = os.path.abspath(f"{path}/{filename}")
            files['media_file'] = open(f'{abs}', 'rb')
            response = requests.post(url=f'{BASE_URL}/media', headers=headers, files=files)
            if response.status_code == 201:
                print(f"[bold blue]{filename}[/bold blue] successfully uploaded!")
            else:
                print(f'Error: {response.text}')

    else:
        files = {}
        files['media_file'] = open(f'{os.path.abspath(path)}', 'rb')
        response = requests.post(url=f'{BASE_URL}/media', headers=headers, files=files)
        if response.status_code == 201:
            print(f"[bold blue]{filename}[/bold blue] successfully uploaded!")
        else:
            print(f'Error: {response.text}')


@apis.command()
def my_media():
    """List all my media"""

    headers = {'authorization': f'Token {AUTH_KEY}'}
    response = requests.get(url=f'{BASE_URL}/media?author={USERNAME}', headers=headers)

    if response.status_code == 200:
        data_json = json.loads(response.text)

        table = Table(show_header=True, header_style="bold magenta")
        table.add_column("Name of the media")
        table.add_column("Media Type")
        table.add_column("State")

        for data in data_json['results']:
            table.add_row(data['title'], data['media_type'], data['state'])
        console.print(table)

    else:
        print(f'Could not get the media: {response.text}')


@apis.command()
def whoami():
    """Shows the details of the authorized user"""
    headers = {'authorization': f'Token {AUTH_KEY}'}
    response = requests.get(url=f'{BASE_URL}/whoami', headers=headers)
    for data, value in json.loads(response.text).items():
        print(data, ' : ', value)


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
