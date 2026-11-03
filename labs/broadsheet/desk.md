# The desk. Everything an editor decides lives here; build.mjs does the rest.
#
# A post with no section here still gets set: images are cut into the text
# by the rules in build.mjs (autoCuts). Add a section only to overrule them.
#
#   ![04 wide](went through my agents,)      cut image 04 into the text right after that phrase
#                                            flags: wide (a band, picture 2 columns), wider (3),
#                                            reverse, line, slide, photo
#                                            two cuts at the same phrase share one band, side by side
#   bar 6 26/26                              proportional rule after paragraph 6
#   lede 3                                   this paragraph takes the drop cap
#   deck 1 2                                 these paragraphs become the standfirst under the headline
#   refer 1 2                                these paragraphs sit in a box under the headline
#   list 8 9 10 11                           tight run, marked with squares
#   stair 15 16 17                           each paragraph one step larger
#   big 22                                   one paragraph set large
#   cols 4                                   how many of the 5 columns the story takes
#
# Paragraph numbers are the block indexes in posts.json, starting at 0.
# Block 0 is always the headline.

## print
# How each image goes on the press. Anything not listed is a halftone photo,
# or `slide` if its alt mentions a slide, screen or projector.
reverse aws-dva/01
reverse commons-agent-logs/04
reverse commons-agent-logs/05
reverse commons-claude-switch/04
reverse commons-peoples-choice/01
reverse pr-flow/01
reverse pr-flow/02
reverse screenshot-declutterer-3/01
line aws-dva/02
line aws-sap/01
line screenshot-declutterer-2/01
line screenshot-declutterer-2/02
line screenshot-declutterer-3/02
line stylemind/01
line stylemind/02
line stylemind/03
photo commons-best-use-of-tech/01
photo commons-best-use-of-tech/02
photo commons-best-use-of-tech/03
slide commons-claude-switch/02

## commons-agent-logs
cols 5
refer 1 2
lede 3
![03](Here is what 18 hours)
![01](The build itself took)
![02](so the room)
![04 wider](went through my agents,)
bar 7 2/300
![05](It came to)
bar 10 180/180
bar 11 44/180

## apple-health-import
cols 4
deck 1 2
bar 6 26/26
list 8 9 10 11
bar 12 21/26
stair 15 16 17
big 22
bar 22 0.1628/26

## lorong-speech-embeddings
cols 4
![03](the disparity in training data for Tamil and Malay was handled.)
![04](they went back to an earlier one.)
![02 wide](Surprisingly, it performed better.)
![05 wide](Surprisingly, it performed better.)
![06](to stop wasting compute on padding.)
![01](answering all my questions.)

## stylemind
cols 4
![03](Deterministic, not guessed by the model.)
![01 wide](around 150 lines apiece.)
![02 wide](around 150 lines apiece.)

## commons-best-use-of-tech
cols 3
![02](by morning agents had prototyped ten ideas for me.)
![03](with your name on it.)
![01 wider](a demo video cut minutes before submission.)

## commons-claude-switch
![01](and it walks onto the projector.)
![04 wider](Four pets at once went live in 13 to 16 seconds.)
![02](The models were fine.)
![03](costs me 30cents)

## aws-sap
![01 wider](The four patterns, in order of cost vs. recovery speed:)

## project the-commons
lead commons-best-use-of-tech/01
show commons-claude-switch 04
show commons-agent-logs 04
show commons-peoples-choice 01
show commons-best-use-of-tech 02 03

## preview
# Which picture stands for a project on the front page. Default: the newest one.
the-commons commons-best-use-of-tech/01
aws-certs aws-sap/01
screenshot-declutterer screenshot-declutterer-3/02
claude-code-notes pr-flow/02
