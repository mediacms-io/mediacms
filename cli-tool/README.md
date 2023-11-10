## MediaCMS CLI Tool
This is the CLI tool to interact with the API of your installation/instance of MediaCMS.

### How to configure and use the tools
- Make sure that you have all the required installations (`cli-tool/requirements.txt`)installed. To install it -
    - Create a new virtualenv using any python virtualenv manager.
    - Then activate the virtualenv and enter `pip install -r requirements.txt`.
- Create an .env file in this folder (`mediacms/cli-tool/`)
- Run the cli tool using the command `python cli.py login`. This will authenticate you and store necessary creds for further authentications.
- To check the credentials and necessary setup, run `python cli.py whoami`. This will show your details.