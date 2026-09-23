import os, json, re, uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
import jwt
from sqlalchemy import create_engine, String, Integer, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, Session, sessionmaker

load_dotenv(Path(__file__).parents[2]/'.env')

DB=os.getenv('DATABASE_URL','sqlite:///./erudites.db'); engine=create_engine(DB); Local=sessionmaker(bind=engine); pwd=CryptContext(schemes=['bcrypt'],deprecated='auto'); auth=HTTPBearer(); SECRET=os.getenv('JWT_SECRET','development-secret')
class Base(DeclarativeBase): pass
class User(Base):
 __tablename__='user'
 id:Mapped[int]=mapped_column(primary_key=True); email:Mapped[str]=mapped_column(String(255),unique=True); password:Mapped[str]=mapped_column(String(255)); name:Mapped[str]=mapped_column(String(120)); profile:Mapped[dict]=mapped_column(JSON,default=dict)
class Interview(Base):
 __tablename__='interview'
 id:Mapped[str]=mapped_column(String(36),primary_key=True); user_id:Mapped[int]=mapped_column(ForeignKey('user.id')); config:Mapped[dict]=mapped_column(JSON); answers:Mapped[list]=mapped_column(JSON,default=list); created_at:Mapped[datetime]=mapped_column(DateTime,default=datetime.utcnow); completed_at:Mapped[datetime]=mapped_column(DateTime,nullable=True, default=None); report:Mapped[dict]=mapped_column(JSON,nullable=True, default=None)
Base.metadata.create_all(engine)
app=FastAPI(title='The Erudites API'); app.add_middleware(CORSMiddleware,allow_origins=['http://localhost:5173','http://localhost:3000'],allow_credentials=True,allow_methods=['*'],allow_headers=['*'])
def db():
 s=Local()
 try: yield s
 finally: s.close()
def token(user): return jwt.encode({'sub':str(user.id),'exp':datetime.now(timezone.utc)+timedelta(days=7)},SECRET,algorithm='HS256')
def me(c:HTTPAuthorizationCredentials=Depends(auth),s:Session=Depends(db)):
 try: uid=int(jwt.decode(c.credentials,SECRET,algorithms=['HS256'])['sub'])
 except Exception: raise HTTPException(401,'Invalid session')
 u=s.get(User,uid)
 if not u: raise HTTPException(401,'Unknown user')
 return u
class Register(BaseModel): name:str; email:EmailStr; password:str
class Profile(BaseModel): name:str|None=None; email:EmailStr|None=None; college:str|None=None; degree:str|None=None; branch:str|None=None; graduation_year:str|None=None; target_role:str|None=None; preferred_language:str|None=None
class Credentials(BaseModel): email:EmailStr; password:str
class Start(BaseModel): branch:str; subject:str|None=None; topic:str|None=None; difficulty:str='Intermediate'; interview_type:str='Technical'; language:str='English'; target_role:str=''
class Answer(BaseModel): question_id:str; transcript:str; duration:float=0; pauses:int=0
MAX_INTERVIEW_QUESTIONS=10
@app.post('/auth/register')
def register(x:Register,s:Session=Depends(db)):
 if s.query(User).filter_by(email=x.email).first(): raise HTTPException(409,'Email already registered')
 u=User(name=x.name,email=x.email,password=pwd.hash(x.password),profile={}); s.add(u);s.commit();s.refresh(u);return {'token':token(u),'user':user_out(u)}
@app.post('/auth/login')
def login(x:Credentials,s:Session=Depends(db)):
 u=s.query(User).filter_by(email=x.email).first()
 if not u or not pwd.verify(x.password,u.password): raise HTTPException(401,'Incorrect email or password')
 return {'token':token(u),'user':user_out(u)}
def user_out(u): return {'id':u.id,'name':u.name,'email':u.email,**u.profile}
@app.get('/profile')
def profile(u:User=Depends(me)): return user_out(u)
@app.put('/profile')
def update_profile(x:Profile,u:User=Depends(me),s:Session=Depends(db)):
 d=u.profile or {}; values=x.model_dump(exclude_none=True);u.name=values.pop('name',u.name); email=values.pop('email',None)
 if email and email!=u.email and s.query(User).filter_by(email=email).first(): raise HTTPException(409,'Email already in use')
 if email:u.email=email
 d.update(values);u.profile=d;s.commit();return user_out(u)
def bank():
 p=Path('/app/question-bank/questions.json')
 if not p.exists(): p=Path(__file__).parents[2]/'question-bank/questions.json'
 return json.loads(p.read_text())
@app.get('/questions/filters')
def filters():
 b=bank(); taxonomy={}
 for q in b:
  branch=taxonomy.setdefault(q['branch'],{}); subject=branch.setdefault(q['subject'],{}); topic=subject.setdefault(q['topic'],set()); topic.add(q['difficulty'])
 taxonomy={branch:{subject:{topic:sorted(levels,key=['Beginner','Intermediate','Advanced'].index) for topic,levels in topics.items()} for subject,topics in subjects.items()} for branch,subjects in taxonomy.items()}
 return {'branches':sorted(taxonomy),'subjects':sorted({q['subject'] for q in b}),'topics':sorted({q['topic'] for q in b}),'difficulties':sorted({q['difficulty'] for q in b},key=['Beginner','Intermediate','Advanced'].index),'interview_types':sorted({q['interview_type'] for q in b}),'taxonomy':taxonomy,'questions':len(b)}
@app.get('/questions')
def questions(branch:str|None=None,subject:str|None=None,topic:str|None=None,difficulty:str|None=None,interview_type:str|None=None,q:str|None=None):
 r=bank()
 for k,v in [('branch',branch),('subject',subject),('topic',topic),('difficulty',difficulty),('interview_type',interview_type)]:
  if v:r=[x for x in r if x[k].lower()==v.lower()]
 if q:r=[x for x in r if q.lower() in (x['question']+' '+x['topic']).lower()]
 return r
def choose(c,used=[]):
 r=[x for x in bank() if x['branch']==c['branch'] and x['difficulty']==c['difficulty'] and x['interview_type']==c['interview_type'] and x['id'] not in used]
 if c.get('subject'): r=[x for x in r if x['subject']==c['subject']] or r
 if c.get('topic'): r=[x for x in r if x['topic']==c['topic']] or r
 if not r: raise HTTPException(404,'No matching questions in bank')
 return r[0]
@app.post('/interviews')
def start(c:Start,u:User=Depends(me),s:Session=Depends(db)):
 config={**c.model_dump(),'max_questions':MAX_INTERVIEW_QUESTIONS}; i=Interview(id=str(uuid.uuid4()),user_id=u.id,config=config);s.add(i);s.commit();return {'id':i.id,'question':choose(i.config),'max_questions':MAX_INTERVIEW_QUESTIONS}
def evaluate(a:Answer,q):
 text=a.transcript.strip().lower(); words=re.findall(r"\b[a-z][a-z']+\b",text); stop={'a','an','and','are','as','at','be','by','for','from','how','i','in','is','it','me','my','of','on','or','so','that','the','their','this','to','was','what','when','with','would','you'}; meaningful=set(words)-stop; fillers=sum(words.count(x) for x in ['um','uh','like','actually','basically']); expected=[x.lower() for x in q['expected_concepts'] if x.lower() not in {'example'}]; question_terms=set(re.findall(r"\b[a-z][a-z']{2,}\b",(q['question']+' '+q['topic']+' '+q['subject']).lower()))-stop; expected_hits=[concept for concept in expected if concept in text]; overlap=meaningful & question_terms; gibberish=len(words)<3 or len(meaningful)<2 or (not overlap and not expected_hits)
 if gibberish:
  relevance=correctness=completeness=structure=technical_depth=0
 else:
  relevance=round(min(100,100*min(1,(len(overlap)+len(expected_hits)*2)/max(4,len(question_terms)*.35))),1); completeness=round(100*len(expected_hits)/max(1,len(expected)),1); structure=round(min(100,20+len(meaningful)*3+(15 if re.search(r'[.!?]',a.transcript) else 0)),1); technical_depth=round(min(100,20+len(expected_hits)*25+len(overlap)*8),1); correctness=round(relevance*.45+completeness*.35+structure*.1+technical_depth*.1,1)
 rate=round(len(words)/(a.duration/60),1) if a.duration else 0; missing=[x for x in q['expected_concepts'] if x.lower() not in text and x.lower()!='example']; strengths=['Your response directly addressed the selected topic.'] if not gibberish and relevance>=50 else []; recommendations=['Use the question language and include a concrete example.'] if gibberish or correctness<60 else ['Add one specific result or trade-off to make the answer more convincing.']
 return {'content':{'relevance':relevance,'correctness':correctness,'completeness':completeness,'structure':structure,'technical_depth':technical_depth,'missing_concepts':missing},'delivery':{'duration_seconds':round(a.duration,1),'speaking_rate_wpm':rate,'pause_count':a.pauses,'filler_words':fillers,'response_words':len(words)},'feedback':{'strengths':strengths,'recommendations':recommendations},'mode':'rules-based demo evaluation'}
@app.post('/interviews/{iid}/answers')
def answer(iid:str,a:Answer,u:User=Depends(me),s:Session=Depends(db)):
 i=s.get(Interview,iid)
 if not i or i.user_id!=u.id: raise HTTPException(404,'Interview not found')
 if len(i.answers or [])>=MAX_INTERVIEW_QUESTIONS: raise HTTPException(400,'This interview has reached the 10-question limit. Complete it to view your report.')
 q=next((x for x in bank() if x['id']==a.question_id),None)
 if not q: raise HTTPException(404,'Question not found')
 result=evaluate(a,q); answers=list(i.answers or []);answers.append({'question':q,'transcript':a.transcript,'evaluation':result});i.answers=answers
 score=result['content']['correctness']; levels=['Beginner','Intermediate','Advanced']; current=levels.index(i.config['difficulty'])
 if score>=80 and current<2:i.config={**i.config,'difficulty':levels[current+1]}
 if score<50 and current>0:i.config={**i.config,'difficulty':levels[current-1]}
 s.commit();
 try: nxt=choose(i.config,[x['question']['id'] for x in answers])
 except HTTPException: nxt=None
 return {'evaluation':result,'next_question':nxt if len(answers)<MAX_INTERVIEW_QUESTIONS else None,'questions_answered':len(answers),'max_questions':MAX_INTERVIEW_QUESTIONS}
@app.post('/interviews/{iid}/complete')
def complete(iid:str,u:User=Depends(me),s:Session=Depends(db)):
 i=s.get(Interview,iid)
 if not i or i.user_id!=u.id: raise HTTPException(404,'Interview not found')
 scores=[a['evaluation']['content']['correctness'] for a in i.answers]; report={'summary':{**i.config,'date':i.created_at.isoformat(),'question_count':len(i.answers)},'overall_score':round(sum(scores)/len(scores),1) if scores else 0,'answers':i.answers,'adaptive_note':'Next session will move up a level after strong answers, or reinforce related foundations after weaker answers.'};i.report=report;i.completed_at=datetime.utcnow();s.commit();return report
@app.get('/dashboard')
def dashboard(u:User=Depends(me),s:Session=Depends(db)):
 rows=s.query(Interview).filter_by(user_id=u.id).filter(Interview.report.isnot(None)).order_by(Interview.created_at.desc()).all(); answers=[answer for interview in rows for answer in (interview.answers or [])]; content_keys=['relevance','correctness','completeness','structure','technical_depth']; delivery=[answer['evaluation']['delivery'] for answer in answers]; content=[answer['evaluation']['content'] for answer in answers]; average=lambda values:round(sum(values)/len(values),1) if values else 0; scores=[x.report['overall_score'] for x in rows]; weakest=sorted(((key,average([item.get(key,0) for item in content])) for key in content_keys),key=lambda item:item[1]) if content else []; strongest=sorted(((key,average([item.get(key,0) for item in content])) for key in content_keys),key=lambda item:item[1],reverse=True) if content else []; answer_scores=[item.get('correctness',0) for item in content]; completed_questions=sum(len(interview.answers or []) for interview in rows); possible_questions=len(rows)*MAX_INTERVIEW_QUESTIONS; session_delta=round(scores[0]-scores[-1],1) if len(scores)>1 else 0
 valid_durations=[item.get('duration_seconds',0) for item in delivery if 0<item.get('duration_seconds',0)<=3600]
 return {'interviews':[{'id':x.id,'date':x.created_at.isoformat(),'score':x.report['overall_score'],'config':x.config} for x in rows],'trend':[{'date':x.created_at.strftime('%b %d'),'score':x.report['overall_score']} for x in rows[::-1]],'analytics':{'average_score':average(scores),'answer_average_score':average(answer_scores),'average_duration_seconds':average(valid_durations),'average_speaking_rate_wpm':average([item.get('speaking_rate_wpm',0) for item in delivery]),'average_filler_words':average([item.get('filler_words',0) for item in delivery]),'rubric_scores':{key:average([item.get(key,0) for item in content]) for key in content_keys},'weakest_area':{'name':weakest[0][0].replace('_',' ').title(),'score':weakest[0][1]} if weakest else None,'strongest_area':{'name':strongest[0][0].replace('_',' ').title(),'score':strongest[0][1]} if strongest else None,'answered_questions':completed_questions,'completion_rate':round(100*completed_questions/possible_questions,1) if possible_questions else 0,'score_change':session_delta,'score_distribution':{'excellent':sum(score>=80 for score in answer_scores),'developing':sum(50<=score<80 for score in answer_scores),'needs_work':sum(score<50 for score in answer_scores)}}}
@app.post('/transcribe')
async def transcribe(audio:UploadFile=File(...),u:User=Depends(me)):
 if not audio.filename: raise HTTPException(400,'Empty recording')
 if not os.getenv('GEMINI_API_KEY'): raise HTTPException(503,'Speech transcription is disabled. Add GEMINI_API_KEY to .env and restart the API, or paste a transcript in demo mode.')
 from google import genai
 from google.genai import types
 content=await audio.read()
 try:
  client=genai.Client(api_key=os.environ['GEMINI_API_KEY'])
  response=client.models.generate_content(model='gemini-2.5-flash',contents=[types.Part.from_bytes(data=content,mime_type=audio.content_type or 'audio/webm'),'Transcribe this recording exactly. Return only the spoken words, with no commentary.'])
 except Exception as exc:
  raise HTTPException(502,f'Gemini transcription failed: {exc}') from exc
 return {'transcript':response.text or '','mode':'Google Gemini'}
@app.post('/resume')
async def resume(file:UploadFile=File(...),u:User=Depends(me)):
 if not file.filename.lower().endswith(('.pdf','.docx')): raise HTTPException(400,'Upload a PDF or DOCX')
 raw=await file.read(); text=''; tmp=Path('/tmp/'+str(uuid.uuid4())+file.filename)
 try:
  tmp.write_bytes(raw)
  if file.filename.lower().endswith('.pdf'):
   from pypdf import PdfReader;text=' '.join(p.extract_text() or '' for p in PdfReader(str(tmp)).pages)
  else:
   from docx import Document;text=' '.join(p.text for p in Document(str(tmp)).paragraphs)
 finally: tmp.unlink(missing_ok=True)
 tech=[x for x in ['Python','Java','React','FastAPI','PostgreSQL','Docker','AWS','Machine Learning','SQL'] if x.lower() in text.lower()]
 return {'skills':tech,'preview':text[:800],'note':'Extracted locally; use these skills to focus your next interview.'}
