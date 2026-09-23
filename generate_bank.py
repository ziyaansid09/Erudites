"""Generate the expandable seed data set. Run from this folder to refresh questions.json."""
import json
branches={
 'CSE':{'Data Structures':['Arrays','Trees','Graphs'],'Algorithms':['Sorting','Dynamic Programming','Complexity'],'Databases':['SQL','Indexing','Transactions']},
 'AIML':{'Machine Learning':['Classification','Regression','Model Evaluation'],'Deep Learning':['Neural Networks','CNNs','Transformers'],'Data Engineering':['Pipelines','Feature Engineering','Data Quality']},
 'IT':{'Web Development':['HTTP','APIs','Security'],'Cloud Computing':['Containers','Scaling','Networking'],'Databases':['SQL','Indexing','Transactions']},
 'Data Science':{'Statistics':['Probability','Hypothesis Testing','Sampling'],'Analytics':['Visualization','Metrics','Experimentation'],'Machine Learning':['Classification','Regression','Model Evaluation']},
 'E&TC/ECE':{'Digital Electronics':['Logic Gates','Flip Flops','Microcontrollers'],'Communication Systems':['Modulation','Signals','Error Control'],'Embedded Systems':['Interrupts','RTOS','Sensors']},
 'Electrical':{'Circuit Theory':['AC Analysis','Power Systems','Transformers'],'Control Systems':['Feedback','Stability','PID'],'Machines':['Motors','Generators','Protection']},
 'Mechanical':{'Thermodynamics':['Heat Transfer','Entropy','Cycles'],'Manufacturing':['Machining','Casting','Quality'],'Design':['Stress','Materials','Tolerances']},
 'Civil':{'Structural Engineering':['Concrete','Steel','Loads'],'Geotechnical':['Soil','Foundations','Compaction'],'Construction':['Planning','Safety','Estimation']},
 'Common':{'Human Resources':['Communication','Conflict','Motivation','Leadership','Teamwork','Recruitment','Performance Management','Workplace Ethics'],'Behavioral Interviews':['Strengths and Weaknesses','Career Goals','Failure and Learning','Leadership Experience','Team Conflict','Adaptability','Work Style','Company Fit'],'Aptitude':['Quantitative','Logical Reasoning','Data Interpretation'],'General Technical':['Problem Solving','Version Control','Testing']}}
templates={
 'Technical':[
    'Explain {topic} and its practical use in {subject}.',
    'How would you apply {topic} in a real project, and what trade-offs would you consider?',
   'How would you test, debug, and improve an implementation involving {topic}?',
   'Compare two approaches to {topic} and explain when you would choose each one.',
   'What failure modes can occur with {topic}, and how would you prevent them?',
   'Design a small solution using {topic} and explain its complexity and limitations.'],
 'HR':[
    'How would you handle a workplace situation involving {topic}? Give a specific example.',
    'What process would you use to manage {topic} fairly and effectively across a team?',
   'How would you measure and improve the impact of {topic} in an organization?',
   'How would you communicate a difficult decision related to {topic} to employees?',
   'What risks should an HR professional consider when handling {topic}?',
   'How would you improve an underperforming process involving {topic}?'],
 'Behavioral':[
    'Tell me about a time you demonstrated {topic}. What was the result?',
    'Describe a difficult situation involving {topic} and explain how you handled it.',
   'What did you learn from an experience involving {topic}, and what would you do differently?',
   'Give another example of {topic} in action and explain how you communicated your decision.',
   'How would you respond if a team situation tested your ability in {topic}?',
   'Describe how you would prepare for a situation that requires {topic}.']}
levels=['Beginner','Beginner','Intermediate','Intermediate','Advanced','Advanced']; rows=[];n=1
for branch,subjects in branches.items():
   for subject,topics in subjects.items():
      for topic in topics:
         interview_type='Technical' if branch!='Common' or subject=='General Technical' else ('HR' if subject=='Human Resources' else 'Behavioral')
         for difficulty,subject_templates in zip(levels,templates[interview_type]):
            rows.append({'id':f'q{n:04}','branch':branch,'subject':subject,'topic':topic,'question':subject_templates.format(topic=topic,subject=subject),'difficulty':difficulty,'interview_type':interview_type,'expected_concepts':[topic,subject.split()[0],'example'],'evaluation_points':['Address the situation','Explain the approach','Give a concrete example']});n+=1
json.dump(rows,open('questions.json','w',encoding='utf8'),indent=2,ensure_ascii=False)
print(f'Wrote {len(rows)} questions')
