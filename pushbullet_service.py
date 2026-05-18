import os
import sys
import argparse
from pushbullet import Pushbullet
from dotenv import load_dotenv

load_dotenv()
token = os.getenv("PUSHBULLET_TOKEN")
if not token:
    print("Error: PUSHBULLET_TOKEN not found in .env")
    sys.exit(1)

pb = Pushbullet(token)

def send_ZAIRE_note(title, body):
    """Sends a simple text notification to all devices."""
    pb.push_note(title, body)

def send_ZAIRE_file(file_path, title="File from ZAIRE"):
    """Pushes a file to your devices."""
    with open(file_path, "rb") as f:
        file_data = pb.upload_file(f, os.path.basename(file_path))
        pb.push_file(**file_data, title=title)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ZAIRE Pushbullet Helper")
    parser.add_argument("--note", nargs=2, metavar=('title', 'body'), help="Send a note")
    parser.add_argument("--file", nargs=1, metavar=('path'), help="Send a file")
    
    args = parser.parse_args()
    
    if args.note:
        send_ZAIRE_note(args.note[0], args.note[1])
        print(f"Note sent: {args.note[0]}")
    elif args.file:
        send_ZAIRE_file(args.file[0])
        print(f"File sent: {args.file[0]}")
    else:
        parser.print_help()
