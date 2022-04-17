### About

This project will be a music practice tool that allows you to synchronize a flashcard card deck to a metronome. 

I originally implemented this in 2018 in Java because that was the first language I learned, but I wanted re-implement it in JavaScript, which I think will work much better. 

The implementation itself is a quick-and-dirty adaptation of the JavaScript drum machine I am working on here https://github.com/adamcogen/drum-machine with some GUI changes. That 'drum machine' repo will probably be cleaner and better-maintained, and uses the same data structure / scheduling algorithm for the backend.

As described in the 'drum machine' repo, this metronome:
 - uses precise audio timing by scheduling notes ahead-of-time with the WebAudio API
 - runs on client-side-only JavaScript (primarily tested in Chrome browser)

I may try to more carefully de-couple the drum machine data structure / scheduler from its GUI at some point in the future, at which point I may refactor this. For now this is a bit hacky since I'm just throwing it together quickly.

### Run locally:

Local HTTP server is needed to avoid Cross Origin Request issues when loading sound files (at least in Chrome browser).

For Mac, run one of the .sh files included in this repo to start the HTTP server:

Python 2:
```
sh server.python2.sh
```

Python 3:
```
sh server.python3.sh
```

then in a browser go to:

```
http://localhost:8000/
```

and replace 8000 with whatever port number the server says it's running on.

For Windows, you should be able to just run the commands that are in these .sh files from the command line to start the HTTP server.

### Java implementation

Just for fun, here is a screen capture of the old Java implementation from 2018, which is not on GitHub. The Java version wasn't as interactive, didn't have as many features, and needed to be run from a JAR file..

![Java Flashcard Metronome](images/java-5.gif "Java Flashcard Metronome")