# MediaCMS

## Project Workflow

```mermaid
sequenceDiagram

box Local
participant main 
participant stable
participant dev
end

box Origin
participant omain 
participant ostable
participant odev
end

box Upstream
participant umain 
end
```



## Branches

- `main` - upstream branch to keep the original code. 
- `stable` - stable branch to keep the stable code.
- `dev` - development branch, features are merged here.
- `features/*` - feature branches, new features are developed here.


Periodically sync changes from the original repository into this main branch:

