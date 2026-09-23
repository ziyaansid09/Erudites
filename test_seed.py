import json
from pathlib import Path
def test_seed_is_large_and_structured():
 data=json.loads((Path(__file__).parents[1]/'question-bank/questions.json').read_text())
 assert len(data)>=500
 assert {'CSE','AIML','IT','Data Science','E&TC/ECE','Electrical','Mechanical','Civil'} <= {x['branch'] for x in data}
 assert {'branch','subject','topic','question','difficulty','interview_type','expected_concepts','evaluation_points'} <= set(data[0])
