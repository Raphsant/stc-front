FROM ubuntu:latest
LABEL authors="sunny"

ENTRYPOINT ["top", "-b"]
